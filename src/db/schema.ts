import { pgTable, text, integer, boolean, timestamp, jsonb, serial, customType, index, check, date } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { Variant, PurchaseLine, Customer, Settings, LabelLayout } from '@/lib/types'

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

// Montos en pesos enteros: los precios de la tienda no usan centavos.

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  subcategory: text('subcategory'),
  material: text('material').notNull().default(''),
  price: integer('price').notNull(),
  offerPrice: integer('offer_price'),
  // La oferta deja de valer sola a esta hora ("¡Sólo por hoy -20%!"). Null = sin vencimiento
  offerEndsAt: timestamp('offer_ends_at', { withTimezone: true }),
  wholesalePrice: integer('wholesale_price'),
  cost: integer('cost').notNull().default(0),
  // Columna cacheada: siempre se modifica junto con un stock_movement, en la misma transacción
  stock: integer('stock').notNull().default(0),
  minStock: integer('min_stock'),
  markupPct: integer('markup_pct'),
  sku: text('sku').notNull(),
  barcode: text('barcode').notNull(),
  image: text('image').notNull().default(''),
  images: jsonb('images').$type<string[]>().notNull().default([]),
  description: text('description'),
  variants: jsonb('variants').$type<Variant | null>(),
  active: boolean('active').notNull().default(true),
  // Borrado lógico: las ventas viejas siguen apuntando al producto
  deleted: boolean('deleted').notNull().default(false),
  externalId: text('external_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('products_barcode_idx').on(t.barcode),
  index('products_category_idx').on(t.category),
  check('stock_no_negativo', sql`${t.stock} >= 0`),
])

export const sales = pgTable('sales', {
  number: serial('number').primaryKey(),
  channel: text('channel').$type<'online' | 'local'>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull().default(0),
  shipping: integer('shipping').notNull().default(0),
  total: integer('total').notNull(),
  payment: text('payment').notNull(),
  status: text('status').notNull(),
  customer: jsonb('customer').$type<Customer | null>(),
  shippingMethod: text('shipping_method'),
  note: text('note'),
  seller: text('seller'),
  // true cuando la venta ya descontó stock (mostrador: al cobrar; online: al confirmarse el pago)
  stockApplied: boolean('stock_applied').notNull().default(false),
  mpPreferenceId: text('mp_preference_id'),
  mpPaymentId: text('mp_payment_id'),
  mpStatus: text('mp_status'),
}, t => [index('sales_created_idx').on(t.createdAt)])

export const saleItems = pgTable('sale_items', {
  id: serial('id').primaryKey(),
  saleNumber: integer('sale_number').notNull().references(() => sales.number, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  name: text('name').notNull(),
  qty: integer('qty').notNull(),
  unitPrice: integer('unit_price').notNull(),
  // Costo congelado al momento de la venta: la ganancia de ayer no cambia si mañana sube el proveedor
  unitCost: integer('unit_cost').notNull(),
  variant: text('variant'),
}, t => [index('sale_items_sale_idx').on(t.saleNumber)])

export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  productId: text('product_id').notNull(),
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(),
  ref: text('ref'),
  by: text('by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('movements_product_idx').on(t.productId), index('movements_created_idx').on(t.createdAt)])

export const purchases = pgTable('purchases', {
  id: serial('id').primaryKey(),
  supplier: text('supplier').notNull(),
  date: date('date').notNull(),
  invoiceNumber: text('invoice_number'),
  lines: jsonb('lines').$type<PurchaseLine[]>().notNull(),
  total: integer('total').notNull(),
  status: text('status').$type<'borrador' | 'confirmada'>().notNull(),
  source: text('source').$type<'foto' | 'manual' | 'repetida'>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const labelTemplates = pgTable('label_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  widthMm: integer('width_mm').notNull(),
  heightMm: integer('height_mm').notNull(),
  cols: integer('cols').notNull(),
  showPrice: boolean('show_price').notNull(),
  showName: boolean('show_name').notNull(),
  showSku: boolean('show_sku').notNull(),
  description: text('description').notNull().default(''),
  // Diseño elegido en el editor de etiquetas (tamaños de letra, orden, alineación...)
  layout: jsonb('layout').$type<LabelLayout>(),
})

// Una sola fila (id = 'main'). Los secretos (API key de Claude) viven en una columna aparte que nunca va al navegador.
export const settings = pgTable('settings', {
  id: text('id').primaryKey(),
  value: jsonb('value').$type<Settings>().notNull(),
  anthropicKey: text('anthropic_key'),
})

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique(),
  phone: text('phone'),
  city: text('city'),
  wholesale: boolean('wholesale').notNull().default(false),
  source: text('source').notNull().default('tienda'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Fotos de productos guardadas en la base: un solo lugar para respaldar. Se sirven por /img/[id] con caché de CDN.
export const images = pgTable('images', {
  id: text('id').primaryKey(),
  contentType: text('content_type').notNull(),
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<'duena' | 'vendedora'>().notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  // sha256 del token de la cookie: si se filtra la base, las sesiones no sirven
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
