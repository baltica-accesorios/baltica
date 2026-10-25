'use server'
// Todas las acciones del panel. Cada una verifica la sesión y, al terminar, revalida las páginas
// para que el panel y la tienda muestren el dato nuevo al instante.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { randomUUID } from 'node:crypto'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { endSession, hashPassword, requireUser } from '@/lib/auth'
import { getSale, getSettings } from '@/lib/data'
import { adjustStock as adjust, changeSaleStatus, createSale, moveStock, StockError } from '@/lib/stock'
import { ean13 } from '@/lib/format'
import { AiUnavailable, readInvoice, type InvoiceReading } from '@/lib/ai'
import type { LabelTemplate, MovementReason, PaymentMethod, Product, Purchase, Sale, SaleStatus, Settings } from '@/lib/types'

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const refresh = () => revalidatePath('/', 'layout')
const fail = (error: string) => ({ ok: false as const, error })

export async function logout() {
  await endSession()
  redirect('/admin/login')
}

// ---------- Ventas ----------

export async function registerLocalSale(items: { productId: string; qty: number; unitPrice: number; variant?: string | null }[], opts: { payment: PaymentMethod; discount: number; seller?: string; customer?: string }): Promise<Result<{ sale: Sale }>> {
  const u = await requireUser()
  if (!items.length || items.some(i => i.qty < 1 || i.unitPrice < 0)) return fail('Venta vacía o con cantidades inválidas')
  try {
    const s = await createSale({ channel: 'local', items, payment: opts.payment, discount: Math.max(0, Math.round(opts.discount)), seller: opts.seller || u.name, customer: opts.customer ? { name: opts.customer } : null, status: 'pagada', applyStock: true, by: opts.seller || u.name })
    refresh()
    return { ok: true, sale: (await getSale(s.number))! }
  } catch (e) {
    if (e instanceof StockError) return fail(e.message + '. Puede que se haya vendido online recién.')
    throw e
  }
}

export async function updateSaleStatus(number: number, status: SaleStatus): Promise<Result> {
  const u = await requireUser()
  try {
    await changeSaleStatus(number, status, u.name)
  } catch (e) {
    if (e instanceof StockError) return fail(e.message)
    throw e
  }
  refresh()
  return { ok: true }
}

// ---------- Stock ----------

export async function adjustStock(productId: string, delta: number, reason: MovementReason, ref?: string): Promise<Result> {
  const u = await requireUser()
  if (!Number.isInteger(delta)) return fail('Cantidad inválida')
  try { await adjust(productId, delta, reason, u.name, ref) } catch (e) { if (e instanceof StockError) return fail(e.message); throw e }
  refresh()
  return { ok: true }
}

/** Conteo físico: lleva cada producto exactamente a lo contado (en una transacción). */
export async function applyCount(counts: { productId: string; counted: number }[]): Promise<Result> {
  const u = await requireUser()
  await db.transaction(async tx => {
    for (const c of counts) {
      const [p] = await tx.select({ stock: schema.products.stock }).from(schema.products).where(eq(schema.products.id, c.productId)).for('update')
      if (p && c.counted >= 0) await moveStock(tx, c.productId, c.counted - p.stock, 'ajuste', u.name, 'conteo')
    }
  })
  refresh()
  return { ok: true }
}

// ---------- Productos ----------

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export async function newBarcode(): Promise<string> {
  await requireUser()
  // Prefijo 779 (Argentina) + 9 dígitos internos + verificador. Se busca uno libre.
  for (;;) {
    const code = ean13('779' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'))
    const [dup] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.barcode, code))
    if (!dup) return code
  }
}

export async function saveProduct(p: Product): Promise<Result<{ id: string }>> {
  const u = await requireUser('duena')
  if (!p.name.trim() || !(p.price > 0)) return fail('Nombre y precio son obligatorios')
  const [existing] = await db.select().from(schema.products).where(eq(schema.products.id, p.id))
  let slug = p.slug || slugify(p.name)
  const [clash] = await db.select({ id: schema.products.id }).from(schema.products).where(and(eq(schema.products.slug, slug), ne(schema.products.id, p.id)))
  if (clash) slug = `${slug}-${p.id.slice(-4)}`
  if (p.barcode) {
    const [dup] = await db.select({ name: schema.products.name }).from(schema.products).where(and(eq(schema.products.barcode, p.barcode), ne(schema.products.id, p.id), eq(schema.products.deleted, false)))
    if (dup) return fail(`El código de barras ya lo usa "${dup.name}"`)
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.products)
  const values = {
    slug, name: p.name.trim(), category: p.category, subcategory: p.subcategory || null, material: p.material,
    price: Math.round(p.price), offerPrice: p.offerPrice ? Math.round(p.offerPrice) : null, offerEndsAt: p.offerPrice && p.offerEndsAt ? new Date(p.offerEndsAt) : null, wholesalePrice: p.wholesalePrice ? Math.round(p.wholesalePrice) : null,
    cost: Math.round(p.cost || 0), minStock: p.minStock ?? null, markupPct: p.markupPct ?? null,
    sku: p.sku || `BA-${p.category.slice(0, 3).toUpperCase()}-${String(n + 1).padStart(3, '0')}`, barcode: p.barcode,
    image: p.images?.[0] ?? p.image, images: p.images?.length ? p.images : [p.image], description: p.description || null,
    variants: p.variants?.attr && p.variants.options.length ? p.variants : null, active: p.active !== false,
  }
  await db.transaction(async tx => {
    if (existing) {
      await tx.update(schema.products).set(values).where(eq(schema.products.id, p.id))
      // El stock no se pisa: la diferencia se registra como ajuste para que quede trazado
      if (p.stock !== existing.stock) await moveStock(tx, p.id, p.stock - existing.stock, 'ajuste', u.name, 'edición de producto')
    } else {
      await tx.insert(schema.products).values({ id: p.id, ...values, stock: 0 })
      if (p.stock > 0) await moveStock(tx, p.id, p.stock, 'ajuste', u.name, 'alta de producto')
    }
  })
  refresh()
  return { ok: true, id: p.id }
}

export async function deleteProduct(id: string): Promise<Result> {
  await requireUser('duena')
  await db.update(schema.products).set({ deleted: true, active: false }).where(eq(schema.products.id, id))
  refresh()
  return { ok: true }
}

export async function bulkPriceUpdate(ids: string[], pctChange: number): Promise<Result> {
  await requireUser('duena')
  if (!ids.length || !Number.isFinite(pctChange) || pctChange <= -100) return fail('Porcentaje inválido')
  const { roundTo: step } = await getSettings()
  await db.update(schema.products).set({ price: sql`greatest(${step}, round(${schema.products.price} * ${1 + pctChange / 100} / ${step}) * ${step})::int` }).where(inArray(schema.products.id, ids))
  refresh()
  return { ok: true }
}

/** Pone en oferta un % sobre el precio actual, con vencimiento opcional ("¡Sólo por hoy!"). pct = 0 quita la oferta. */
export async function bulkOffer(ids: string[], pct: number, endsAt: string | null): Promise<Result> {
  await requireUser('duena')
  if (!ids.length || !Number.isFinite(pct) || pct < 0 || pct >= 100) return fail('Porcentaje inválido')
  const ends = endsAt ? new Date(endsAt) : null
  if (ends && ends <= new Date()) return fail('La fecha de fin tiene que ser en el futuro')
  if (pct === 0) await db.update(schema.products).set({ offerPrice: null, offerEndsAt: null }).where(inArray(schema.products.id, ids))
  else await db.update(schema.products).set({ offerPrice: sql`round(${schema.products.price} * ${1 - pct / 100})::int`, offerEndsAt: ends }).where(inArray(schema.products.id, ids))
  refresh()
  return { ok: true }
}

/** Sube una foto (ya achicada en el navegador) y devuelve su URL. */
export async function uploadImage(form: FormData): Promise<Result<{ url: string }>> {
  await requireUser()
  const f = form.get('file')
  if (!(f instanceof File) || !f.type.startsWith('image/')) return fail('Elegí una imagen')
  if (f.size > 5 * 1024 * 1024) return fail('La imagen es muy pesada (máximo 5 MB)')
  const id = randomUUID()
  await db.insert(schema.images).values({ id, contentType: f.type, data: Buffer.from(await f.arrayBuffer()) })
  return { ok: true, url: `/img/${id}` }
}

// ---------- Compras ----------

export async function confirmPurchase(pu: Omit<Purchase, 'id' | 'status' | 'total'>, applyPrices: boolean): Promise<Result> {
  const u = await requireUser('duena')
  const lines = pu.lines.filter(l => l.qty > 0)
  if (!lines.some(l => l.productId)) return fail('Vinculá al menos un renglón con un producto')
  const total = lines.reduce((a, l) => a + l.qty * l.unitCost, 0)
  await db.transaction(async tx => {
    const [row] = await tx.insert(schema.purchases).values({ supplier: pu.supplier, date: pu.date, invoiceNumber: pu.invoiceNumber || null, lines, total, status: 'confirmada', source: pu.source }).returning({ id: schema.purchases.id })
    for (const l of lines) {
      if (!l.productId) continue
      await moveStock(tx, l.productId, l.qty, 'compra', u.name, 'c' + row.id)
      await tx.update(schema.products).set({ cost: Math.round(l.unitCost), markupPct: l.markupPct, ...(applyPrices ? { price: Math.round(l.suggestedPrice) } : {}) }).where(eq(schema.products.id, l.productId))
    }
  })
  refresh()
  return { ok: true }
}

// ---------- Configuración ----------

export async function saveSettings(patch: Partial<Settings>): Promise<Result> {
  await requireUser('duena')
  const value = { ...(await getSettings()), ...patch }
  await db.insert(schema.settings).values({ id: 'main', value }).onConflictDoUpdate({ target: schema.settings.id, set: { value } })
  refresh()
  return { ok: true }
}

export async function saveAnthropicKey(key: string): Promise<Result> {
  await requireUser('duena')
  const k = key.trim()
  if (k && !k.startsWith('sk-ant-')) return fail('La clave de Claude empieza con "sk-ant-"')
  await db.insert(schema.settings).values({ id: 'main', value: await getSettings(), anthropicKey: k || null }).onConflictDoUpdate({ target: schema.settings.id, set: { anthropicKey: k || null } })
  refresh()
  return { ok: true }
}

export async function upsertTemplate(t: LabelTemplate): Promise<Result> {
  await requireUser()
  await db.insert(schema.labelTemplates).values(t).onConflictDoUpdate({ target: schema.labelTemplates.id, set: { ...t } })
  refresh()
  return { ok: true }
}

export async function deleteTemplate(id: string): Promise<Result> {
  await requireUser()
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.labelTemplates)
  if (n <= 1) return fail('Tiene que quedar al menos una plantilla')
  await db.delete(schema.labelTemplates).where(eq(schema.labelTemplates.id, id))
  refresh()
  return { ok: true }
}

// ---------- Usuarios ----------

export async function listUsers() {
  await requireUser('duena')
  return db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.users.role, active: schema.users.active }).from(schema.users).orderBy(schema.users.id)
}

export async function createUser(input: { name: string; email: string; password: string; role: 'duena' | 'vendedora' }): Promise<Result> {
  await requireUser('duena')
  if (input.password.length < 8) return fail('La contraseña tiene que tener al menos 8 caracteres')
  const email = input.email.trim().toLowerCase()
  const [dup] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email))
  if (dup) return fail('Ya hay un usuario con ese email')
  await db.insert(schema.users).values({ name: input.name.trim(), email, passwordHash: await hashPassword(input.password), role: input.role })
  refresh()
  return { ok: true }
}

export async function setUserActive(id: number, active: boolean): Promise<Result> {
  const u = await requireUser('duena')
  if (id === u.id) return fail('No podés desactivar tu propio usuario')
  await db.update(schema.users).set({ active }).where(eq(schema.users.id, id))
  if (!active) await db.delete(schema.sessions).where(eq(schema.sessions.userId, id))
  refresh()
  return { ok: true }
}

export async function changePassword(id: number, password: string): Promise<Result> {
  const u = await requireUser()
  if (u.role !== 'duena' && u.id !== id) return fail('Sin permiso')
  if (password.length < 8) return fail('La contraseña tiene que tener al menos 8 caracteres')
  await db.update(schema.users).set({ passwordHash: await hashPassword(password) }).where(eq(schema.users.id, id))
  return { ok: true }
}

// ---------- Lectura de facturas con Claude (opcional) ----------

export async function readInvoicePhoto(form: FormData): Promise<Result<{ reading: InvoiceReading }>> {
  await requireUser('duena')
  const f = form.get('file')
  if (!(f instanceof File)) return fail('Elegí la foto o el PDF de la factura')
  if (f.size > 20 * 1024 * 1024) return fail('El archivo es muy pesado (máximo 20 MB)')
  const okType = f.type === 'application/pdf' || ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type)
  if (!okType) return fail('Formato no soportado. Usá JPG, PNG o PDF.')
  const catalog = (await db.select({ id: schema.products.id, name: schema.products.name, sku: schema.products.sku, barcode: schema.products.barcode, cost: schema.products.cost }).from(schema.products).where(eq(schema.products.deleted, false)))
  try {
    const reading = await readInvoice({ data: Buffer.from(await f.arrayBuffer()).toString('base64'), mediaType: f.type }, catalog)
    return { ok: true, reading }
  } catch (e) {
    if (e instanceof AiUnavailable) return fail(e.message)
    console.error('readInvoice', e)
    return fail('No se pudo leer la factura. Probá con una foto más nítida o cargala a mano.')
  }
}
