'use server'
import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/data'
import { createSale, StockError } from '@/lib/stock'
import { createPreference, mpEnabled } from '@/lib/mercadopago'
import { currentPrice } from '@/lib/pricing'

const Input = z.object({
  lines: z.array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(50), variant: z.string().optional() })).min(1).max(50),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email().max(200),
    phone: z.string().trim().min(6).max(40),
    city: z.string().trim().max(80).optional(),
    address: z.string().trim().max(200).optional(),
    zip: z.string().trim().max(10).optional(),
  }),
  payment: z.enum(['mercadopago', 'transferencia', 'efectivo']),
  shippingId: z.string(),
})

export type CheckoutResult = { ok: true; number: number; redirect: string } | { ok: false; error: string }

/** Confirma el pedido. Precios, descuentos y stock se calculan acá con los datos reales, nunca con los del navegador. */
export async function checkout(raw: z.input<typeof Input>): Promise<CheckoutResult> {
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Revisá tus datos: nombre, email y teléfono son obligatorios.' }
  const { lines, customer, payment, shippingId } = parsed.data
  const settings = await getSettings()

  const ship = settings.shippingOptions.find(s => s.id === shippingId)
  if (!ship) return { ok: false, error: 'Elegí un medio de envío.' }
  if (ship.id !== 'retiro' && !customer.address) return { ok: false, error: 'Completá la dirección de entrega.' }
  if (payment === 'mercadopago' && !mpEnabled()) return { ok: false, error: 'Mercado Pago no está disponible en este momento. Elegí transferencia.' }
  if (payment === 'efectivo' && !(settings.cashOnPickup && ship.id === 'retiro')) return { ok: false, error: 'El pago en efectivo es sólo al retirar en el showroom.' }

  const ids = [...new Set(lines.map(l => l.productId))]
  const prods = await db.select().from(schema.products).where(and(inArray(schema.products.id, ids), eq(schema.products.active, true), eq(schema.products.deleted, false)))
  const byId = new Map(prods.map(p => [p.id, p]))
  for (const l of lines) {
    const p = byId.get(l.productId)
    if (!p) return { ok: false, error: 'Un producto de tu carrito ya no está disponible. Sacalo y probá de nuevo.' }
    const wanted = lines.filter(x => x.productId === l.productId).reduce((a, x) => a + x.qty, 0)
    if (p.stock < wanted) return { ok: false, error: p.stock ? `De "${p.name}" quedan sólo ${p.stock}.` : `"${p.name}" se quedó sin stock.` }
  }
  const items = lines.map(l => { const p = byId.get(l.productId)!; return { productId: p.id, qty: l.qty, unitPrice: currentPrice(p), variant: l.variant ?? null, name: p.name, image: p.image } })
  const subtotal = items.reduce((a, i) => a + i.qty * i.unitPrice, 0)
  const discount = payment === 'transferencia' ? Math.round(subtotal * settings.transferDiscountPct / 100) : 0

  // Guardamos al cliente para tener su historial (el email identifica)
  await db.insert(schema.customers).values({ name: customer.name, email: customer.email.toLowerCase(), phone: customer.phone, city: customer.city })
    .onConflictDoUpdate({ target: schema.customers.email, set: { name: customer.name, phone: customer.phone, city: customer.city } })

  try {
    // Transferencia/efectivo reservan el stock al crear el pedido; Mercado Pago lo descuenta al aprobarse el pago.
    const sale = await createSale({
      channel: 'online', items, payment, discount, shipping: ship.price, shippingMethod: ship.name, customer: { ...customer, email: customer.email.toLowerCase() },
      status: 'pendiente', applyStock: payment !== 'mercadopago', by: 'tienda online',
    })
    if (payment !== 'mercadopago') return { ok: true, number: sale.number, redirect: `/checkout/resultado?pedido=${sale.number}` }
    try {
      const url = await createPreference({ saleNumber: sale.number, items, shipping: ship.price, shippingName: ship.name, payer: customer })
      return { ok: true, number: sale.number, redirect: url }
    } catch (e) {
      console.error('Mercado Pago', e)
      await db.update(schema.sales).set({ status: 'cancelada', note: 'No se pudo crear el pago en Mercado Pago' }).where(eq(schema.sales.number, sale.number))
      return { ok: false, error: 'No pudimos conectar con Mercado Pago. Probá de nuevo en unos minutos o elegí transferencia.' }
    }
  } catch (e) {
    if (e instanceof StockError) return { ok: false, error: e.message + '. Alguien lo compró recién.' }
    throw e
  }
}
