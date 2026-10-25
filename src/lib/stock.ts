// Núcleo del stock unificado. Toda modificación de stock pasa por acá, dentro de una transacción.
//
// La regla de concurrencia (ver docs/ARQUITECTURA.md §4): el UPDATE condicional
// `SET stock = stock - n WHERE stock >= n` toma el lock de la fila y nunca deja el stock negativo.
// Si dos cobros compiten por la última unidad, Postgres los serializa y el segundo recibe StockError.
import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { db, schema, type Tx } from '@/db'
import { saleId } from './data'
import type { Channel, Customer, MovementReason, PaymentMethod, SaleItem, SaleStatus } from './types'

export class StockError extends Error {
  constructor(public productId: string, public productName: string, public available: number) {
    super(`Sin stock suficiente de "${productName}" (quedan ${available})`)
  }
}

export async function moveStock(tx: Tx, productId: string, delta: number, reason: MovementReason, by: string, ref?: string) {
  if (delta === 0) return
  const p = schema.products
  const where = delta < 0 ? and(eq(p.id, productId), gte(p.stock, -delta)) : eq(p.id, productId)
  const [row] = await tx.update(p).set({ stock: sql`${p.stock} + ${delta}` }).where(where).returning({ stock: p.stock })
  if (!row) {
    const [cur] = await tx.select({ name: p.name, stock: p.stock }).from(p).where(eq(p.id, productId))
    throw new StockError(productId, cur?.name ?? productId, cur?.stock ?? 0)
  }
  await tx.insert(schema.stockMovements).values({ productId, delta, reason, by, ref })
}

/** Descuenta (sign=-1) o devuelve (sign=1) el stock de todos los renglones. Ordena por producto para evitar deadlocks. */
async function moveItems(tx: Tx, items: { productId: string; qty: number }[], sign: 1 | -1, reason: MovementReason, by: string, ref: string) {
  const byProduct = new Map<string, number>()
  for (const i of items) byProduct.set(i.productId, (byProduct.get(i.productId) ?? 0) + i.qty)
  for (const id of [...byProduct.keys()].sort()) await moveStock(tx, id, sign * byProduct.get(id)!, reason, by, ref)
}

export interface NewSale {
  channel: Channel
  items: { productId: string; qty: number; unitPrice: number; variant?: string | null }[]
  payment: PaymentMethod
  discount?: number
  shipping?: number
  shippingMethod?: string | null
  customer?: Customer | null
  seller?: string | null
  note?: string | null
  status: SaleStatus
  applyStock: boolean
  by: string
}

/** Crea la venta con el costo congelado de cada producto y, si corresponde, descuenta stock. Todo o nada. */
export async function createSale(s: NewSale) {
  return db.transaction(async tx => {
    const ids = [...new Set(s.items.map(i => i.productId))]
    const prods = await tx.select({ id: schema.products.id, name: schema.products.name, cost: schema.products.cost }).from(schema.products).where(inArray(schema.products.id, ids))
    const byId = new Map(prods.map(p => [p.id, p]))
    const items: SaleItem[] = s.items.map(i => {
      const p = byId.get(i.productId)
      if (!p) throw new Error('Producto inexistente: ' + i.productId)
      return { productId: p.id, name: p.name, qty: i.qty, unitPrice: i.unitPrice, unitCost: p.cost, variant: i.variant ?? null }
    })
    const subtotal = items.reduce((a, i) => a + i.qty * i.unitPrice, 0)
    const discount = s.discount ?? 0
    const shipping = s.shipping ?? 0
    const [sale] = await tx.insert(schema.sales).values({
      channel: s.channel, subtotal, discount, shipping, total: subtotal - discount + shipping, payment: s.payment, status: s.status,
      customer: s.customer ?? null, shippingMethod: s.shippingMethod ?? null, seller: s.seller ?? null, note: s.note ?? null, stockApplied: s.applyStock,
    }).returning()
    await tx.insert(schema.saleItems).values(items.map(i => ({ ...i, saleNumber: sale.number })))
    if (s.applyStock) await moveItems(tx, items, -1, s.channel === 'local' ? 'venta_local' : 'venta_online', s.by, saleId(sale.number))
    return { ...sale, items }
  })
}

const CONSUMES_STOCK: SaleStatus[] = ['pagada', 'enviada', 'entregada']

/**
 * Cambia el estado de una venta respetando el stock:
 * - cancelar devuelve lo descontado
 * - pasar a pagada/enviada/entregada una venta que todavía no descontó, descuenta (y falla si no alcanza)
 */
export async function changeSaleStatus(number: number, status: SaleStatus, by: string) {
  return db.transaction(async tx => {
    const [sale] = await tx.select().from(schema.sales).where(eq(schema.sales.number, number)).for('update')
    if (!sale) throw new Error('Venta inexistente')
    const items = await tx.select().from(schema.saleItems).where(eq(schema.saleItems.saleNumber, number))
    const ref = saleId(number)
    let stockApplied = sale.stockApplied
    if (status === 'cancelada' && stockApplied) { await moveItems(tx, items, 1, 'devolucion', by, ref); stockApplied = false }
    if (CONSUMES_STOCK.includes(status) && !stockApplied) { await moveItems(tx, items, -1, sale.channel === 'local' ? 'venta_local' : 'venta_online', by, ref); stockApplied = true }
    await tx.update(schema.sales).set({ status, stockApplied }).where(eq(schema.sales.number, number))
  })
}

export async function adjustStock(productId: string, delta: number, reason: MovementReason, by: string, ref?: string) {
  await db.transaction(tx => moveStock(tx, productId, delta, reason, by, ref))
}

export { moveItems }
