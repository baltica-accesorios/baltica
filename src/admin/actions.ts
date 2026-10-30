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
import { moveItems, adjustStock as adjust, changeSaleStatus, createSale, moveStock, setStock, StockError } from '@/lib/stock'

import { attributeDefinition, productInput, settingsPatch } from '@/lib/validation'
import { productStockTotal, redistributionError, variantStructureChanged, attributeKey, attributesOf, combinationOptions } from '@/lib/variants'
import { normCode } from '@/lib/coupons'
import { sendEmail, siteUrl } from '@/lib/email'
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
  if (!items.length || items.some(i => !Number.isInteger(i.qty) || i.qty < 1 || !Number.isInteger(i.unitPrice) || i.unitPrice < 0)) return fail('Venta vacía o con cantidades inválidas')
  if (!Number.isInteger(opts.discount) || opts.discount < 0 || opts.discount > items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)) return fail('Descuento inválido')
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
    return fail(e instanceof Error ? e.message : 'No se pudo actualizar la venta')
  }
  refresh()
  return { ok: true }
}

// ---------- Stock ----------

export async function adjustStock(productId: string, delta: number, reason: MovementReason, ref?: string, variant?: string | null): Promise<Result> {
  const u = await requireUser()
  if (!Number.isInteger(delta)) return fail('Cantidad inválida')
  try { await adjust(productId, delta, reason, u.name, ref, variant) } catch (e) { if (e instanceof StockError) return fail(e.message); throw e }
  refresh()
  return { ok: true }
}

/** Conteo físico: lleva cada producto exactamente a lo contado (en una transacción). */
export async function applyCount(counts: { productId: string; variant?: string | null; counted: number }[]): Promise<Result> {
  const u = await requireUser()
  await db.transaction(async tx => {
    for (const c of counts) {
      const [p] = await tx.select({ stock: schema.products.stock, vs: schema.products.variantStock }).from(schema.products).where(eq(schema.products.id, c.productId)).for('update')
      if (!p || c.counted < 0) continue
      const current = c.variant && p.vs ? p.vs[c.variant] ?? 0 : p.stock
      await moveStock(tx, c.productId, c.counted - current, 'ajuste', u.name, 'conteo', c.variant)
    }
  })
  refresh()
  return { ok: true }
}

// ---------- Productos ----------

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export async function newBarcode(): Promise<string> {
  await requireUser()
  // Código interno de seis cifras, imprimible y escaneable con CODE128.
  for (;;) {
    const code = String(100000 + Math.floor(Math.random() * 900000))
    const [dup] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.barcode, code))
    if (!dup) return code
  }
}

export async function saveProduct(p: Product): Promise<Result<{ id: string }>> {
  const u = await requireUser('duena')
  const checked = productInput.safeParse(p)
  if (!checked.success) return fail(checked.error.issues.map(i => i.path.join('.') + ': ' + i.message).join('; '))
  p = checked.data
  const attrs = attributesOf(p.variants)
  if (new Set(attrs.map(a => attributeKey(a.attr))).size !== attrs.length || attrs.some(a => new Set(a.options.map(attributeKey)).size !== a.options.length)) return fail('No repitas atributos ni opciones del mismo atributo')
  if (p.variants?.attributes && p.variants.attributes.reduce((n, a) => n * a.options.length, 1) > 500) return fail('Máximo 500 combinaciones por producto')
  if (p.variants?.attributes && JSON.stringify(combinationOptions(p.variants.attributes)) !== JSON.stringify(p.variants.options)) return fail('Las combinaciones no coinciden con los atributos')
  if (p.variants && new Set(p.variants.options).size !== p.variants.options.length) return fail('Hay variantes repetidas')
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
  const options = values.variants?.options ?? []
  const allocationError = await db.transaction(async tx => {
    if (existing) {
      const [current] = await tx.select().from(schema.products).where(eq(schema.products.id, p.id)).for('update')
      if (current.stock > 0 && variantStructureChanged(current.variants, values.variants)) {
        const error = redistributionError(current.stock, productStockTotal(p))
        if (error) return error
      }
    }
    const ref = existing ? 'edición de producto' : 'alta de producto'
    if (!existing) await tx.insert(schema.products).values({ id: p.id, ...values, stock: 0, variantStock: options.length ? Object.fromEntries(options.map(o => [o, 0])) : null })
    else await tx.update(schema.products).set(values).where(eq(schema.products.id, p.id))
    // El stock nunca se pisa: cada diferencia se registra como ajuste para que quede trazada
    await setStock(tx, p.id, options.length ? { perVariant: Object.fromEntries(options.map(o => [o, p.variantStock?.[o] ?? 0])) } : { total: p.stock }, 'ajuste', u.name, ref)
  })
  if (allocationError) return fail(allocationError)
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
      await moveStock(tx, l.productId, l.qty, 'compra', u.name, 'c' + row.id, l.variant)
      await tx.update(schema.products).set({ cost: Math.round(l.unitCost), markupPct: l.markupPct, ...(applyPrices ? { price: Math.round(l.suggestedPrice) } : {}) }).where(eq(schema.products.id, l.productId))
    }
  })
  refresh()
  return { ok: true }
}

// ---------- Configuración ----------

export async function saveSettings(patch: Partial<Settings>): Promise<Result> {
  await requireUser('duena')
  const checked = settingsPatch.safeParse(patch)
  if (!checked.success) return fail(checked.error.issues.map(i => i.path.join('.') + ': ' + i.message).join('; '))
  const previous = await getSettings()
  const value = { ...previous, ...checked.data }
  if (checked.data.attributes) {
    const definitions = checked.data.attributes
    if (new Set(definitions.map(a => a.id)).size !== definitions.length || new Set(definitions.map(a => attributeKey(a.name))).size !== definitions.length) return fail('Hay atributos repetidos')
    if (definitions.some(a => new Set(a.values.map(v => attributeKey(v.label))).size !== a.values.length)) return fail('Hay opciones repetidas en un atributo')
    const rows = await db.select({ variants: schema.products.variants }).from(schema.products).where(eq(schema.products.deleted, false))
    for (const old of previous.attributes ?? []) {
      const uses = rows.flatMap(p => attributesOf(p.variants)).filter(a => a.catalogId === old.id || attributeKey(a.attr) === attributeKey(old.name))
      if (!uses.length) continue
      const next = definitions.find(a => a.id === old.id)
      if (!next || next.name !== old.name || uses.some(a => a.options.some(option => !next.values.some(v => v.label === option)))) return fail(`El atributo "${old.name}" está en uso. Conservá su nombre y las opciones asignadas a productos; podés agregar opciones y cambiar los colores.`)
    }
  }
  if (value.categories && (new Set(value.categories.map(c => c.slug)).size !== value.categories.length || value.categories.some(c => new Set(c.children?.map(s => s.slug)).size !== (c.children?.length ?? 0)))) return fail('Hay categorías o subcategorías repetidas')
  if (new Set(value.shippingOptions.map(o => o.id)).size !== value.shippingOptions.length) return fail('Hay envíos repetidos')
  if (new Set(value.promotions?.map(p => p.id)).size !== (value.promotions?.length ?? 0)) return fail('Hay promociones repetidas')
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

// ---------- Cupones ----------

export async function saveCoupon(c: { code: string; type: 'pct' | 'fixed' | 'envio'; value: number; minAmount: number; endsAt: string | null; maxUses: number | null; active: boolean }, isNew: boolean): Promise<Result> {
  await requireUser('duena')
  if (c.endsAt && !Number.isFinite(Date.parse(c.endsAt))) return fail('Fecha inválida')
  if (!Number.isFinite(c.value) || !Number.isFinite(c.minAmount) || c.minAmount < 0 || (c.maxUses !== null && (!Number.isInteger(c.maxUses) || c.maxUses < 1))) return fail('Valores de cupón inválidos')
  const code = normCode(c.code)
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return fail('El código tiene que tener entre 3 y 30 letras o números, sin espacios')
  if (c.type === 'pct' && !(c.value > 0 && c.value <= 100)) return fail('El porcentaje tiene que estar entre 1 y 100')
  if (c.type === 'fixed' && !(c.value > 0)) return fail('Indicá el monto del descuento')
  const values = { type: c.type, value: c.type === 'envio' ? 0 : Math.round(c.value), minAmount: Math.max(0, Math.round(c.minAmount || 0)), endsAt: c.endsAt ? new Date(c.endsAt) : null, maxUses: c.maxUses && c.maxUses > 0 ? Math.round(c.maxUses) : null, active: c.active }
  if (isNew) {
    const [dup] = await db.select({ code: schema.coupons.code }).from(schema.coupons).where(eq(schema.coupons.code, code))
    if (dup) return fail('Ya existe un cupón con ese código')
    await db.insert(schema.coupons).values({ code, ...values })
  } else await db.update(schema.coupons).set(values).where(eq(schema.coupons.code, code))
  refresh()
  return { ok: true }
}

export async function deleteCoupon(code: string): Promise<Result> {
  await requireUser('duena')
  await db.delete(schema.coupons).where(eq(schema.coupons.code, code))
  refresh()
  return { ok: true }
}

// ---------- Clientes y mensajes ----------

export async function setWholesale(id: number, status: 'aprobado' | 'rechazado' | 'none'): Promise<Result> {
  await requireUser('duena')
  const [c] = await db.update(schema.customers).set({ wholesaleStatus: status }).where(eq(schema.customers.id, id)).returning({ name: schema.customers.name, email: schema.customers.email })
  if (c?.email && status === 'aprobado') await sendEmail(c.email, 'Tu cuenta mayorista de Báltica está aprobada', '¡Cuenta mayorista aprobada!', [`Hola ${c.name.split(' ')[0]}, ya podés ver los precios mayoristas en toda la tienda. Ingresá con tu email y contraseña.`], { label: 'Ir a la tienda', url: `${siteUrl()}/cuenta` })
  refresh()
  return { ok: true }
}

export async function setMessageHandled(id: number, handled: boolean): Promise<Result> {
  await requireUser()
  await db.update(schema.messages).set({ handled }).where(eq(schema.messages.id, id))
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

export async function quickUpdateProduct(id: string, price: number, stock: number, variantStock?: Record<string, number> | null): Promise<Result> {
  const u = await requireUser('duena')
  if (!Number.isInteger(price) || price <= 0 || !Number.isInteger(stock) || stock < 0 || Object.values(variantStock ?? {}).some(n => !Number.isInteger(n) || n < 0)) return fail('Precio o stock inválido')
  await db.transaction(async tx => {
    const [p] = await tx.select().from(schema.products).where(eq(schema.products.id, id)).for('update')
    if (!p) throw new Error('Producto inexistente')
    const options = p.variants?.options ?? []
    if (options.length && (!variantStock || options.some(o => !(o in variantStock)))) throw new Error('Completá el stock de todas las variantes')
    await tx.update(schema.products).set({ price }).where(eq(schema.products.id, id))
    await setStock(tx, id, options.length ? { perVariant: Object.fromEntries(options.map(o => [o, variantStock![o]])) } : { total: stock }, 'ajuste', u.name, 'edición rápida')
  })
  refresh(); return { ok: true }
}

export async function updateFulfillment(number: number, field: 'paid' | 'packed' | 'delivered', value: boolean): Promise<Result<{ sale: Sale }>> {
  const u = await requireUser()
  if (!['paid', 'packed', 'delivered'].includes(field) || typeof value !== 'boolean') return fail('Estado inválido')
  try {
    await db.transaction(async tx => {
      const [s] = await tx.select().from(schema.sales).where(eq(schema.sales.number, number)).for('update')
      if (!s || s.channel !== 'online' || s.status === 'cancelada') throw new Error('El seguimiento corresponde a pedidos online activos')
      if (s.payment === 'mercadopago' && !s.paid && value) throw new Error('Esperá la confirmación de Mercado Pago')
      if (field === 'paid' && s.payment === 'mercadopago') throw new Error('Mercado Pago confirma el pago automáticamente')
      let stockApplied = s.stockApplied
      if (value && !stockApplied) {
        const items = await tx.select().from(schema.saleItems).where(eq(schema.saleItems.saleNumber, number))
        await moveItems(tx, items, -1, 'venta_online', u.name, 's' + number); stockApplied = true
      }
      const next = { paid: s.paid, packed: s.packed, delivered: s.delivered, [field]: value }
      const status = next.delivered ? 'entregada' : s.status === 'enviada' ? 'enviada' : next.paid ? 'pagada' : 'pendiente'
      await tx.update(schema.sales).set({ ...next, status, stockApplied }).where(eq(schema.sales.number, number))
    })
  } catch (e) { return fail(e instanceof Error ? e.message : 'No se pudo actualizar') }
  refresh(); return { ok: true, sale: (await getSale(number))! }
}

export async function editSale(number: number, lines: { productId: string; qty: number; unitPrice: number; variant?: string | null }[], expected: string): Promise<Result<{ sale: Sale }>> {
  const u = await requireUser()
  if (!lines.length || lines.length > 200 || lines.some(i => !Number.isInteger(i.qty) || i.qty < 1 || !Number.isInteger(i.unitPrice) || i.unitPrice < 0)) return fail('Revisá las cantidades y precios')
  try {
    await db.transaction(async tx => {
      const [s] = await tx.select().from(schema.sales).where(eq(schema.sales.number, number)).for('update')
      if (!s || s.status === 'cancelada') throw new Error('La venta está cancelada o ya no existe')
      const old = await tx.select().from(schema.saleItems).where(eq(schema.saleItems.saleNumber, number)).orderBy(schema.saleItems.id)
      const fingerprint = JSON.stringify(old.map(i => [i.productId, i.qty, i.unitPrice, i.variant]))
      if (fingerprint !== expected) throw new Error('Otra persona modificó la venta. Cerrala y volvé a abrirla.')
      if (s.payment === 'mercadopago' && !s.mpPaymentId) throw new Error('Esperá a que se confirme el pago de Mercado Pago antes de editar el pedido')
      const prods = await tx.select().from(schema.products).where(inArray(schema.products.id, [...new Set(lines.map(i => i.productId))]))
      const items = lines.map(i => {
        const p = prods.find(p => p.id === i.productId)
        if (!p || (p.deleted && !old.some(o => o.productId === p.id))) throw new Error('Producto no disponible')
        if (p.variants?.options.length && !p.variants.options.includes(i.variant ?? '')) throw new Error(`Elegí la variante de ${p.name}`)
        const prior = old.find(o => o.productId === p.id && o.variant === (i.variant || null))
        return { ...i, variant: i.variant || null, name: prior?.name ?? p.name, unitCost: prior?.unitCost ?? p.cost, saleNumber: number }
      })
      const subtotal = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)
      if (subtotal < s.discount) throw new Error('El subtotal no puede ser menor al descuento aplicado')
      // Lock all products in a stable order before returning and consuming stock.
      await tx.select({ id: schema.products.id }).from(schema.products).where(inArray(schema.products.id, [...new Set([...old, ...items].map(i => i.productId))])).orderBy(schema.products.id).for('update')
      if (s.stockApplied) {
        await moveItems(tx, old, 1, 'devolucion', u.name, `s${number} · edición`)
        await moveItems(tx, items, -1, s.channel === 'online' ? 'venta_online' : 'venta_local', u.name, `s${number} · edición`)
      }
      await tx.delete(schema.saleItems).where(eq(schema.saleItems.saleNumber, number))
      await tx.insert(schema.saleItems).values(items)
      await tx.update(schema.sales).set({ subtotal, total: subtotal - s.discount + s.shipping }).where(eq(schema.sales.number, number))
    })
  } catch (e) { return fail(e instanceof Error ? e.message : 'No se pudo editar la venta') }
  refresh(); return { ok: true, sale: (await getSale(number))! }
}

export async function saveAttribute(raw: import('@/lib/types').AttributeDefinition): Promise<Result> {
  await requireUser('duena')
  const result = attributeDefinition.safeParse(raw)
  if (!result.success) return fail(result.error.issues.map(i => i.message).join('; '))
  const attributes = (await getSettings()).attributes ?? []
  return saveSettings({ attributes: [...attributes.filter(a => a.id !== result.data.id), result.data] })
}
export async function deleteAttribute(id: string): Promise<Result> {
  await requireUser('duena')
  return saveSettings({ attributes: ((await getSettings()).attributes ?? []).filter(a => a.id !== id) })
}
