// Carga inicial de la base.
//   pnpm db:seed           → configuración, plantillas de etiquetas y los 163 productos actuales de la tienda
//   pnpm db:seed --demo    → además, 120 días de ventas ficticias (sólo para mostrar el sistema)
// Se puede correr más de una vez: no duplica productos.
import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db, schema } from '../src/db'
import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from '../src/lib/defaults'
import { buildProducts, buildHistory, buildPurchases } from './demo-history'

const demo = process.argv.includes('--demo')

// Reparte el stock entre los talles (el export real de Empretienda trae el stock de cada uno)
const splitStock = (stock: number, options: string[]) => options.length ? Object.fromEntries(options.map((o, i) => [o, Math.floor(stock / options.length) + (i < stock % options.length ? 1 : 0)])) : null

async function main() {
  await db.insert(schema.settings).values({ id: 'main', value: DEFAULT_SETTINGS }).onConflictDoNothing()
  await db.insert(schema.labelTemplates).values(DEFAULT_TEMPLATES).onConflictDoNothing()

  const products = buildProducts()
  const inserted = await db.insert(schema.products).values(products.map(p => ({
    id: p.id, slug: p.slug, name: p.name, category: p.category, subcategory: p.subcategory, material: p.material,
    price: Math.round(p.price), offerPrice: p.offerPrice ?? null, cost: p.cost, stock: p.stock, minStock: p.minStock ?? null,
    markupPct: p.markupPct ?? null, sku: p.sku, barcode: p.barcode, image: p.image, images: p.images ?? [p.image],
    description: p.description ?? null, variants: p.variants ?? null, variantStock: splitStock(p.stock, p.variants?.options ?? []), createdAt: new Date(p.createdAt),
  }))).onConflictDoNothing().returning({ id: schema.products.id, stock: schema.products.stock })
  if (inserted.length) await db.insert(schema.stockMovements).values(inserted.map(p => ({ productId: p.id, delta: p.stock, reason: 'migracion', by: 'Importación Empretienda' })))
  console.log(`Productos nuevos: ${inserted.length} (de ${products.length})`)

  if (demo) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.sales)
    if (n > 0) { console.log('Ya hay ventas cargadas: no se agregan ventas de demo.'); return }
    const { sales } = buildHistory(products)
    for (const s of sales) {
      const [row] = await db.insert(schema.sales).values({
        channel: s.channel, createdAt: new Date(s.createdAt), subtotal: s.subtotal, discount: s.discount, total: s.total,
        payment: s.payment, status: s.status, paid: ['pagada', 'enviada', 'entregada'].includes(s.status), delivered: s.status === 'entregada', customer: s.customer ?? null, seller: s.seller ?? null, stockApplied: s.status !== 'pendiente',
      }).returning({ number: schema.sales.number })
      await db.insert(schema.saleItems).values(s.items.map(i => ({ saleNumber: row.number, productId: i.productId, name: i.name, qty: i.qty, unitPrice: i.unitPrice, unitCost: i.unitCost, variant: i.variant ?? null })))
      await db.insert(schema.stockMovements).values(s.items.map(i => ({ productId: i.productId, delta: -i.qty, reason: s.channel === 'local' ? 'venta_local' : 'venta_online', ref: 's' + row.number, by: s.seller ?? 'tienda online', createdAt: new Date(s.createdAt) })))
    }
    for (const p of buildPurchases(products)) {
      await db.insert(schema.purchases).values({ supplier: p.supplier, date: p.date, invoiceNumber: p.invoiceNumber, lines: p.lines, total: p.total, status: p.status, source: p.source })
    }
    console.log(`Ventas de demo: ${sales.length}`)
  }
}

main().then(() => process.exit(0), e => { console.error(e); process.exit(1) })
