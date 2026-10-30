'use server'
import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { promotionalProduct, twoForOneDiscount } from '@/lib/promotions'
import { getSettings, toProduct } from '@/lib/data'
import { createSale, StockError } from '@/lib/stock'
import { createPreference, mpEnabled } from '@/lib/mercadopago'
import { variantPrice } from '@/lib/variants'
import { currentCustomer } from '@/lib/customer-auth'
import { quoteShipping } from '@/lib/shipping'
import { orderEmails } from '@/lib/order-emails'
import { checkCoupon, claimCoupon, releaseCoupon } from '@/lib/coupons'

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
  coupon: z.string().max(40).optional(),
})

export type CheckoutResult = { ok: true; number: number; redirect: string } | { ok: false; error: string }

/** Confirma el pedido. Precios, descuentos y stock se calculan acá con los datos reales, nunca con los del navegador. */
export async function checkout(raw: z.input<typeof Input>): Promise<CheckoutResult> {
  const parsed = Input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Revisá tus datos: nombre, email y teléfono son obligatorios.' }
  const { lines, customer, payment, shippingId, coupon } = parsed.data
  const settings = await getSettings()
  const me = await currentCustomer()

  // Se vuelve a cotizar en el servidor: el precio del envío nunca viene del navegador
  const units = lines.reduce((a, l) => a + l.qty, 0)
  const ship = (await quoteShipping(customer.zip ?? '', units)).find(s => s.id === shippingId)
  if (!ship) return { ok: false, error: 'Elegí un medio de envío para tu código postal.' }
  if (ship.id !== 'retiro' && !customer.address) return { ok: false, error: 'Completá la dirección de entrega.' }
  if (payment === 'mercadopago' && !mpEnabled()) return { ok: false, error: 'Mercado Pago no está disponible en este momento. Elegí transferencia.' }
  if (payment === 'efectivo' && !(settings.cashOnPickup && ship.id === 'retiro')) return { ok: false, error: 'El pago en efectivo es sólo al retirar en el showroom.' }

  const ids = [...new Set(lines.map(l => l.productId))]
  const prods = await db.select().from(schema.products).where(and(inArray(schema.products.id, ids), eq(schema.products.active, true), eq(schema.products.deleted, false)))
  const byId = new Map(prods.map(p => [p.id, p]))
  for (const l of lines) {
    const p = byId.get(l.productId)
    if (!p) return { ok: false, error: 'Un producto de tu carrito ya no está disponible. Sacalo y probá de nuevo.' }
    const hasVariants = !!(p.variantStock && Object.keys(p.variantStock).length)
    if (hasVariants && !(l.variant && l.variant in p.variantStock!)) return { ok: false, error: `Elegí el talle de "${p.name}" de nuevo (sacalo del carrito y volvé a agregarlo).` }
    const avail = hasVariants ? p.variantStock![l.variant!] ?? 0 : p.stock
    const wanted = lines.filter(x => x.productId === l.productId && (!hasVariants || x.variant === l.variant)).reduce((a, x) => a + x.qty, 0)
    const label = `"${p.name}"${hasVariants ? ` (${l.variant})` : ''}`
    if (avail < wanted) return { ok: false, error: avail ? `De ${label} quedan sólo ${avail}.` : `${label} se quedó sin stock.` }
  }
  const items = lines.map(l => { const p = byId.get(l.productId)!; return { productId: p.id, qty: l.qty, unitPrice: me?.wholesale && p.wholesalePrice ? p.wholesalePrice : variantPrice(promotionalProduct(toProduct(p), settings.promotions ?? []), l.variant), variant: l.variant ?? null, name: p.name, image: p.image } })
  const subtotal = items.reduce((a, i) => a + i.qty * i.unitPrice, 0)
  const promotionDiscount = twoForOneDiscount(items.map(i => ({ productId: i.productId, category: byId.get(i.productId)!.category, qty: i.qty, price: i.unitPrice })), settings.promotions ?? [])
  let couponDiscount = 0, freeShipping = false, couponCode: string | null = null
  if (coupon?.trim()) {
    const c = await checkCoupon(coupon, subtotal - promotionDiscount)
    if (!c.ok) return { ok: false, error: `Cupón: ${c.error}` }
    couponDiscount = c.discount; freeShipping = c.freeShipping; couponCode = c.code
  }
  const transferDiscount = payment === 'transferencia' ? Math.round((subtotal - promotionDiscount - couponDiscount) * settings.transferDiscountPct / 100) : 0
  const discount = promotionDiscount + couponDiscount + transferDiscount
  const shippingCost = freeShipping ? 0 : ship.price

  // Guardamos al cliente para tener su historial (el email identifica)
  await db.insert(schema.customers).values({ name: customer.name, email: customer.email.toLowerCase(), phone: customer.phone, city: customer.city })
    .onConflictDoUpdate({ target: schema.customers.email, set: { name: customer.name, phone: customer.phone, city: customer.city } })

  if (couponCode && !(await claimCoupon(couponCode))) return { ok: false, error: 'Cupón: se terminaron los usos disponibles' }
  try {
    // Transferencia/efectivo reservan el stock al crear el pedido; Mercado Pago lo descuenta al aprobarse el pago.
    const sale = await createSale({
      channel: 'online', items, payment, discount, couponCode, shipping: shippingCost, shippingMethod: ship.name, customer: { ...customer, email: customer.email.toLowerCase() },
      status: 'pendiente', applyStock: payment !== 'mercadopago', by: 'tienda online',
    })
    if (payment !== 'mercadopago') { await orderEmails(sale.number, 'creado'); return { ok: true, number: sale.number, redirect: `/checkout/resultado?pedido=${sale.number}` } }
    try {
      const url = await createPreference({ saleNumber: sale.number, items, discount, shipping: shippingCost, shippingName: ship.name, payer: customer })
      return { ok: true, number: sale.number, redirect: url }
    } catch (e) {
      console.error('Mercado Pago', e)
      await db.update(schema.sales).set({ status: 'cancelada', note: 'No se pudo crear el pago en Mercado Pago' }).where(eq(schema.sales.number, sale.number))
      return { ok: false, error: 'No pudimos conectar con Mercado Pago. Probá de nuevo en unos minutos o elegí transferencia.' }
    }
  } catch (e) {
    if (couponCode) await releaseCoupon(couponCode)
    if (e instanceof StockError) return { ok: false, error: e.message + '. Alguien lo compró recién.' }
    throw e
  }
}

/** Para mostrar el descuento en el resumen antes de confirmar */
export async function previewCoupon(code: string, subtotal: number) {
  return checkCoupon(code, Math.max(0, Math.round(subtotal)))
}

/** Opciones y precios de envío para un código postal (carrito, checkout y ficha de producto) */
export async function getShippingQuotes(zip: string, units: number) {
  return quoteShipping(String(zip).slice(0, 10), Math.max(1, Math.min(200, Math.round(units) || 1)))
}

export async function previewCart(lines: { productId: string; qty: number; variant?: string }[]) {
  const checked = z.array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(50), variant: z.string().optional() })).max(50).parse(lines)
  if (!checked.length) return { subtotal: 0, promotionDiscount: 0 }
  const settings = await getSettings(), me = await currentCustomer()
  const rows = await db.select().from(schema.products).where(and(inArray(schema.products.id, checked.map(l => l.productId)), eq(schema.products.active, true), eq(schema.products.deleted, false)))
  const priced = checked.map(l => {
    const p = rows.find(p => p.id === l.productId)
    if (!p) throw new Error('Un producto ya no está disponible')
    return { ...l, category: p.category, price: me?.wholesale && p.wholesalePrice ? p.wholesalePrice : variantPrice(promotionalProduct(toProduct(p), settings.promotions ?? []), l.variant) }
  })
  return { subtotal: priced.reduce((s, l) => s + l.price * l.qty, 0), promotionDiscount: twoForOneDiscount(priced, settings.promotions ?? []) }
}
