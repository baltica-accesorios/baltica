// Lecturas de la base convertidas a los tipos del dominio. Sólo se usa desde el servidor.
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from './defaults'
import { offerActive } from './pricing'
import type { LabelTemplate, MovementReason, PaymentMethod, Product, PublicProduct, Purchase, Sale, SaleStatus, Settings, StockMovement } from './types'

type ProductRow = typeof schema.products.$inferSelect
type SaleRow = typeof schema.sales.$inferSelect

export function toProduct(r: ProductRow): Product {
  return {
    id: r.id, slug: r.slug, name: r.name, category: r.category, subcategory: r.subcategory, material: r.material,
    price: r.price, offerPrice: r.offerPrice, offerEndsAt: r.offerEndsAt?.toISOString() ?? null, wholesalePrice: r.wholesalePrice, cost: r.cost, stock: r.stock,
    minStock: r.minStock, markupPct: r.markupPct, sku: r.sku, barcode: r.barcode, image: r.image,
    images: r.images.length ? r.images : [r.image], description: r.description, variants: r.variants, variantStock: r.variantStock,
    createdAt: r.createdAt.toISOString(), active: r.active,
  }
}

export function toPublic(p: Product): PublicProduct {
  const { id, slug, name, category, subcategory, price, stock, image, images, description, variants, variantStock, createdAt } = p
  // Las ofertas vencidas no llegan a la tienda
  const on = offerActive(p)
  return { id, slug, name, category, subcategory, price, offerPrice: on ? p.offerPrice : null, offerEndsAt: on ? p.offerEndsAt : null, stock, image, images, description, variants, variantStock, createdAt }
}

export const saleId = (n: number) => 's' + n

function toSale(r: SaleRow, items: (typeof schema.saleItems.$inferSelect)[]): Sale {
  return {
    id: saleId(r.number), number: r.number, channel: r.channel, createdAt: r.createdAt.toISOString(),
    items: items.map(i => ({ productId: i.productId, name: i.name, qty: i.qty, unitPrice: i.unitPrice, unitCost: i.unitCost, variant: i.variant })),
    subtotal: r.subtotal, discount: r.discount, shipping: r.shipping, total: r.total, payment: r.payment as PaymentMethod,
    status: r.status as SaleStatus, customer: r.customer, shippingMethod: r.shippingMethod, note: r.note, seller: r.seller,
    stockApplied: r.stockApplied, mpPaymentId: r.mpPaymentId,
  }
}

export async function getSettings(): Promise<Settings> {
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.id, 'main'))
  return { ...DEFAULT_SETTINGS, ...row?.value }
}

export async function getAnthropicKey(): Promise<string | null> {
  const [row] = await db.select({ k: schema.settings.anthropicKey }).from(schema.settings).where(eq(schema.settings.id, 'main'))
  return row?.k || null
}

export async function listProducts(): Promise<Product[]> {
  const rows = await db.select().from(schema.products).where(eq(schema.products.deleted, false)).orderBy(asc(schema.products.id))
  return rows.map(toProduct)
}

export async function getProduct(id: string): Promise<Product | null> {
  const [r] = await db.select().from(schema.products).where(and(eq(schema.products.id, id), eq(schema.products.deleted, false)))
  return r ? toProduct(r) : null
}

const visible = and(eq(schema.products.active, true), eq(schema.products.deleted, false))

export async function publicProducts(filter: { category?: string; subcategory?: string; search?: string } = {}): Promise<PublicProduct[]> {
  const conds = [visible]
  if (filter.category) conds.push(eq(schema.products.category, filter.category))
  if (filter.subcategory) conds.push(eq(schema.products.subcategory, filter.subcategory))
  if (filter.search) conds.push(sql`unaccent_lower(${schema.products.name}) like '%' || unaccent_lower(${filter.search}) || '%'`)
  const rows = await db.select().from(schema.products).where(and(...conds)).orderBy(desc(schema.products.createdAt))
  return rows.map(r => toPublic(toProduct(r)))
}

export async function publicProductBySlug(slug: string): Promise<PublicProduct | null> {
  const [r] = await db.select().from(schema.products).where(and(eq(schema.products.slug, slug), visible))
  return r ? toPublic(toProduct(r)) : null
}

async function attachItems(rows: SaleRow[]): Promise<Sale[]> {
  if (!rows.length) return []
  const items = await db.select().from(schema.saleItems).where(inArray(schema.saleItems.saleNumber, rows.map(r => r.number)))
  const by = new Map<number, typeof items>()
  for (const i of items) { const l = by.get(i.saleNumber) ?? []; l.push(i); by.set(i.saleNumber, l) }
  return rows.map(r => toSale(r, by.get(r.number) ?? []))
}

/** Ventas desde una fecha (para métricas), de la más vieja a la más nueva, como las usa lib/metrics. */
export async function salesSince(days: number): Promise<Sale[]> {
  const since = new Date(Date.now() - days * 86400000)
  const rows = await db.select().from(schema.sales).where(gte(schema.sales.createdAt, since)).orderBy(asc(schema.sales.createdAt))
  return attachItems(rows)
}

export async function recentSales(limit = 500): Promise<Sale[]> {
  const rows = await db.select().from(schema.sales).orderBy(desc(schema.sales.createdAt)).limit(limit)
  return (await attachItems(rows)).reverse()
}

export async function allSales(): Promise<Sale[]> {
  const rows = await db.select().from(schema.sales).orderBy(asc(schema.sales.number))
  return attachItems(rows)
}

export async function getSale(number: number): Promise<Sale | null> {
  const [r] = await db.select().from(schema.sales).where(eq(schema.sales.number, number))
  return r ? (await attachItems([r]))[0] : null
}

export async function recentMovements(limit = 200): Promise<StockMovement[]> {
  const rows = await db.select().from(schema.stockMovements).orderBy(desc(schema.stockMovements.id)).limit(limit)
  return rows.reverse().map(m => ({ id: String(m.id), productId: m.productId, delta: m.delta, reason: m.reason as MovementReason, variant: m.variant, ref: m.ref, createdAt: m.createdAt.toISOString(), by: m.by }))
}

export async function listPurchases(): Promise<Purchase[]> {
  const rows = await db.select().from(schema.purchases).orderBy(desc(schema.purchases.id))
  return rows.map(p => ({ id: String(p.id), supplier: p.supplier, date: p.date, invoiceNumber: p.invoiceNumber, lines: p.lines, total: p.total, status: p.status, source: p.source }))
}

export async function listTemplates(): Promise<LabelTemplate[]> {
  let rows = await db.select().from(schema.labelTemplates).orderBy(asc(schema.labelTemplates.id))
  // Primera vez: se guardan las plantillas de fábrica para que se puedan editar
  if (!rows.length) { await db.insert(schema.labelTemplates).values(DEFAULT_TEMPLATES).onConflictDoNothing(); rows = await db.select().from(schema.labelTemplates).orderBy(asc(schema.labelTemplates.id)) }
  return rows.map(r => ({ ...r, layout: r.layout ?? null }))
}

export async function adminBadges(threshold: number) {
  const [low] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.products)
    .where(and(eq(schema.products.deleted, false), sql`${schema.products.stock} <= coalesce(${schema.products.minStock}, ${threshold})`))
  const [pending] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.sales).where(inArray(schema.sales.status, ['pendiente', 'a_resolver']))
  return { low: low.n, pending: pending.n }
}
