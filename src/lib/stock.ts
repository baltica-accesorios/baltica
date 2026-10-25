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
  constructor(public productId: string, public productName: string, public available: number, public variant?: string | null) {
    super(`Sin stock suficiente de "${productName}"${variant ? ` (${variant})` : ''} (quedan ${available})`)
  }
}

/**
 * Mueve stock de un producto o, si tiene stock por talle, de una opción puntual.
 * En el caso con talle se actualizan la opción y el total en el mismo UPDATE (una sola fila, atómico).
 */
export async function moveStock(tx: Tx, productId: string, delta: number, reason: MovementReason, by: string, ref?: string, variant?: string | null) {
  if (delta === 0) return
  const p = schema.products
  const [cur] = await tx.select({ name: p.name, stock: p.stock, vs: p.variantStock }).from(p).where(eq(p.id, productId))
  if (!cur) throw new Error('Producto inexistente: ' + productId)
  const keys = cur.vs ? Object.keys(cur.vs) : []
  if (keys.length && !(variant && keys.includes(variant))) {
    // Producto con talles pero sin talle indicado: no se puede descontar a ciegas; lo que entra va al primer talle para que la suma cierre
    if (delta < 0) throw new StockError(productId, cur.name, 0, variant ? `${variant}: talle inexistente` : 'falta elegir el talle')
    variant = keys[0]
  }
  const perVariant = keys.length > 0
  let row: { stock: number } | undefined
  if (perVariant) {
    const vStock = sql`coalesce((${p.variantStock}->>${variant})::int, 0)`
    const where = delta < 0 ? and(eq(p.id, productId), gte(p.stock, -delta), sql`${vStock} >= ${-delta}`) : eq(p.id, productId)
    ;[row] = await tx.update(p).set({ stock: sql`${p.stock} + ${delta}`, variantStock: sql`jsonb_set(${p.variantStock}, ARRAY[${variant}]::text[], to_jsonb(${vStock} + ${delta}))` }).where(where).returning({ stock: p.stock })
  } else {
    const where = delta < 0 ? and(eq(p.id, productId), gte(p.stock, -delta)) : eq(p.id, productId)
    ;[row] = await tx.update(p).set({ stock: sql`${p.stock} + ${delta}` }).where(where).returning({ stock: p.stock })
  }
  if (!row) {
    const [now] = await tx.select({ stock: p.stock, vs: p.variantStock }).from(p).where(eq(p.id, productId))
    throw new StockError(productId, cur.name, perVariant ? now?.vs?.[variant!] ?? 0 : now?.stock ?? 0, perVariant ? variant : null)
  }
  await tx.insert(schema.stockMovements).values({ productId, delta, reason, by, ref, variant: perVariant ? variant : null })
}

/** Descuenta (sign=-1) o devuelve (sign=1) el stock de todos los renglones. Ordena por producto/talle para evitar deadlocks. */
async function moveItems(tx: Tx, items: { productId: string; qty: number; variant?: string | null }[], sign: 1 | -1, reason: MovementReason, by: string, ref: string) {
  const grouped = new Map<string, { productId: string; variant: string | null; qty: number }>()
  for (const i of items) {
    const k = `${i.productId}\u0000${i.variant ?? ''}`
    const g = grouped.get(k) ?? { productId: i.productId, variant: i.variant ?? null, qty: 0 }
    g.qty += i.qty; grouped.set(k, g)
  }
  for (const k of [...grouped.keys()].sort()) { const g = grouped.get(k)!; await moveStock(tx, g.productId, sign * g.qty, reason, by, ref, g.variant) }
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

export async function adjustStock(productId: string, delta: number, reason: MovementReason, by: string, ref?: string, variant?: string | null) {
  await db.transaction(tx => moveStock(tx, productId, delta, reason, by, ref, variant))
}

/**
 * Lleva el stock de un producto a un valor objetivo (total, o por talle), registrando cada diferencia como movimiento.
 * Se usa al editar un producto y al importar desde Empretienda. Talles que desaparecen sacan su stock; los nuevos arrancan en 0.
 */
export async function setStock(tx: Tx, productId: string, target: { total: number } | { perVariant: Record<string, number> }, reason: MovementReason, by: string, ref: string) {
  const p = schema.products
  const [cur] = await tx.select({ stock: p.stock, vs: p.variantStock }).from(p).where(eq(p.id, productId)).for('update')
  if ('total' in target) {
    if (cur.vs) await tx.update(p).set({ variantStock: null }).where(eq(p.id, productId))
    if (target.total !== cur.stock) await moveStock(tx, productId, Math.max(0, Math.round(target.total)) - cur.stock, reason, by, ref)
    return
  }
  const options = Object.keys(target.perVariant)
  if (!cur.vs && cur.stock > 0) await moveStock(tx, productId, -cur.stock, reason, by, ref)
  const old = cur.vs ?? {}
  for (const [o, n] of Object.entries(old)) if (!options.includes(o) && n > 0) await moveStock(tx, productId, -n, reason, by, `${ref} · talle ${o} eliminado`, o)
  const vs = Object.fromEntries(options.map(o => [o, old[o] ?? 0]))
  await tx.update(p).set({ variantStock: vs, stock: Object.values(vs).reduce((a, b) => a + b, 0) }).where(eq(p.id, productId))
  for (const o of options) { const want = Math.max(0, Math.round(target.perVariant[o])); if (want !== vs[o]) await moveStock(tx, productId, want - vs[o], reason, by, ref, o) }
}

export { moveItems }
