// Lecturas de la base convertidas a los tipos del dominio. Sólo se usa desde el servidor.
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from './defaults'
import { offerActive } from './pricing'
import type { Coupon, LabelTemplate, MovementReason, PaymentMethod, Product, PublicProduct, Purchase, Sale, SaleStatus, Settings, StockMovement } from './types'

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

/** `wholesale`: cliente mayorista aprobado → ve el precio mayorista (si el producto lo tiene) */
export function toPublic(p: Product, wholesale = false): PublicProduct {
  const { id, slug, name, category, subcategory, stock, image, images, description, variants, variantStock, createdAt } = p
  if (wholesale && p.wholesalePrice) return { id, slug, name, category, subcategory, price: p.wholesalePrice, offerPrice: null, offerEndsAt: null, stock, image, images, description, variants, variantStock, createdAt, wholesale: true }
  const price = p.price
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
    stockApplied: r.stockApplied, mpPaymentId: r.mpPaymentId, couponCode: r.couponCode,
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

export async function publicProducts(filter: { category?: string; subcategory?: string; search?: string } = {}, wholesale = false): Promise<PublicProduct[]> {
  const conds = [visible]
  if (filter.category) conds.push(eq(schema.products.category, filter.category))
  if (filter.subcategory) conds.push(eq(schema.products.subcategory, filter.subcategory))
  if (filter.search) conds.push(sql`unaccent_lower(${schema.products.name}) like '%' || unaccent_lower(${filter.search}) || '%'`)
  const rows = await db.select().from(schema.products).where(and(...conds)).orderBy(desc(schema.products.createdAt))
  return rows.map(r => toPublic(toProduct(r), wholesale))
}

export async function publicProductBySlug(slug: string, wholesale = false): Promise<PublicProduct | null> {
  const [r] = await db.select().from(schema.products).where(and(eq(schema.products.slug, slug), visible))
  return r ? toPublic(toProduct(r), wholesale) : null
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
  const [wh] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.customers).where(eq(schema.customers.wholesaleStatus, 'pendiente'))
  const [msg] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.messages).where(eq(schema.messages.handled, false))
  return { low: low.n, pending: pending.n, customers: wh.n + msg.n }
}

export async function listCoupons(): Promise<Coupon[]> {
  const rows = await db.select().from(schema.coupons).orderBy(desc(schema.coupons.createdAt))
  return rows.map(c => ({ code: c.code, type: c.type, value: c.value, minAmount: c.minAmount, endsAt: c.endsAt?.toISOString() ?? null, maxUses: c.maxUses, uses: c.uses, active: c.active }))
}

export interface CustomerRow { id: number; name: string; email: string | null; phone: string | null; city: string | null; hasAccount: boolean; wholesaleStatus: string; wholesaleNote: string | null; source: string; createdAt: string; orders: number; spent: number; lastOrder: string | null }

export async function listCustomers(): Promise<CustomerRow[]> {
  const rows = await db.execute<{ id: number; name: string; email: string | null; phone: string | null; city: string | null; has_account: boolean; wholesale_status: string; wholesale_note: string | null; source: string; created_at: string; orders: number; spent: number; last_order: string | null }>(sql`
    select c.id, c.name, c.email, c.phone, c.city, c.password_hash is not null as has_account, c.wholesale_status, c.wholesale_note, c.source, c.created_at,
      count(s.number)::int as orders, coalesce(sum(s.total), 0)::int as spent, max(s.created_at) as last_order
    from ${schema.customers} c
    left join ${schema.sales} s on s.channel = 'online' and s.status <> 'cancelada' and lower(s.customer->>'email') = c.email
    group by c.id order by (c.wholesale_status = 'pendiente') desc, max(s.created_at) desc nulls last, c.created_at desc`)
  return [...rows].map(r => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, city: r.city, hasAccount: r.has_account, wholesaleStatus: r.wholesale_status, wholesaleNote: r.wholesale_note, source: r.source, createdAt: new Date(r.created_at).toISOString(), orders: r.orders, spent: r.spent, lastOrder: r.last_order ? new Date(r.last_order).toISOString() : null }))
}

export async function listMessages() {
  const rows = await db.select().from(schema.messages).orderBy(desc(schema.messages.createdAt)).limit(200)
  return rows.map(m => ({ ...m, createdAt: m.createdAt.toISOString() }))
}
