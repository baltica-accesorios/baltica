'use server'
// Migración desde Empretienda a partir de los exports que la dueña descarga de su panel.
// Cada paso se puede correr varias veces: actualiza lo existente y agrega lo nuevo, sin duplicar.
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { and, eq, like, or, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireUser } from '@/lib/auth'
import { getAnthropicKey, getSettings } from '@/lib/data'
import { mapColumns, AiUnavailable } from '@/lib/ai'
import { parseTable, parseMoney, parseDate } from '@/lib/sheets'
import { moveStock } from '@/lib/stock'
import { ean13 } from '@/lib/format'
import { CATEGORIES } from '@/data/categories'

export type Kind = 'productos' | 'clientes' | 'ventas'
type Field = { key: string; label: string; required?: boolean; hints: string[] }

const FIELDS: Record<Kind, Field[]> = {
  productos: [
    { key: 'externalId', label: 'ID del producto en Empretienda (agrupa variantes)', hints: ['id producto', 'id'] },
    { key: 'name', label: 'Nombre del producto', required: true, hints: ['nombre', 'producto', 'titulo', 'título'] },
    { key: 'category', label: 'Categoría', hints: ['categoria', 'categoría', 'categorias'] },
    { key: 'subcategory', label: 'Subcategoría', hints: ['subcategoria', 'subcategoría'] },
    { key: 'price', label: 'Precio de venta', required: true, hints: ['precio'] },
    { key: 'offerPrice', label: 'Precio de oferta / promocional', hints: ['oferta', 'promocional'] },
    { key: 'offerEndsAt', label: 'Fecha de fin de la oferta', hints: ['fecha oferta', 'fin oferta', 'vencimiento'] },
    { key: 'wholesalePrice', label: 'Precio mayorista', hints: ['mayorista'] },
    { key: 'stock', label: 'Stock / cantidad', hints: ['stock', 'cantidad'] },
    { key: 'sku', label: 'SKU / código interno', hints: ['sku', 'codigo', 'código'] },
    { key: 'barcode', label: 'Código de barras (EAN)', hints: ['barra', 'ean', 'gtin'] },
    { key: 'cost', label: 'Costo', hints: ['costo'] },
    { key: 'description', label: 'Descripción', hints: ['descripcion', 'descripción'] },
    { key: 'images', label: 'Imágenes (URLs)', hints: ['imagen', 'imagenes', 'foto', 'url'] },
    { key: 'variantAttr', label: 'Nombre del atributo de la variante (ej. Talle)', hints: ['atributo', 'nombre atributo', 'variante'] },
    { key: 'variantValue', label: 'Valor de la variante (ej. 1.6cm)', hints: ['valor', 'opcion', 'opción'] },
    { key: 'visible', label: 'Visible / publicado (sí/no)', hints: ['visible', 'publicado', 'activo', 'mostrar'] },
  ],
  clientes: [
    { key: 'name', label: 'Nombre y apellido', required: true, hints: ['nombre', 'cliente'] },
    { key: 'email', label: 'Email', hints: ['email', 'mail', 'correo'] },
    { key: 'phone', label: 'Teléfono', hints: ['telefono', 'teléfono', 'celular', 'whatsapp'] },
    { key: 'city', label: 'Ciudad / localidad', hints: ['ciudad', 'localidad'] },
    { key: 'wholesale', label: 'Es mayorista (sí/no)', hints: ['mayorista'] },
  ],
  ventas: [
    { key: 'number', label: 'Número de venta / orden', required: true, hints: ['numero', 'número', 'orden', 'venta', 'pedido', 'id'] },
    { key: 'date', label: 'Fecha', required: true, hints: ['fecha'] },
    { key: 'total', label: 'Total de la venta', required: true, hints: ['total'] },
    { key: 'status', label: 'Estado', hints: ['estado'] },
    { key: 'payment', label: 'Medio de pago', hints: ['pago', 'medio de pago'] },
    { key: 'shipping', label: 'Costo de envío', hints: ['envio', 'envío'] },
    { key: 'customerName', label: 'Nombre del cliente', hints: ['cliente', 'nombre'] },
    { key: 'email', label: 'Email del cliente', hints: ['email', 'mail'] },
    { key: 'phone', label: 'Teléfono del cliente', hints: ['telefono', 'teléfono'] },
    { key: 'city', label: 'Ciudad', hints: ['ciudad', 'localidad'] },
    { key: 'productName', label: 'Producto (si hay un renglón por producto)', hints: ['producto', 'articulo', 'artículo'] },
    { key: 'qty', label: 'Cantidad del producto', hints: ['cantidad'] },
    { key: 'unitPrice', label: 'Precio unitario del producto', hints: ['precio unitario', 'precio'] },
  ],
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const slugify = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function guessMapping(kind: Kind, headers: string[]) {
  const used = new Set<string>()
  const out: Record<string, string> = {}
  for (const f of FIELDS[kind]) {
    const h = headers.find(h => !used.has(h) && f.hints.some(k => norm(h) === norm(k))) ?? headers.find(h => !used.has(h) && f.hints.some(k => norm(h).includes(norm(k))))
    if (h) { out[f.key] = h; used.add(h) }
  }
  return out
}

export interface Analysis { headers: string[]; sample: Record<string, string>[]; count: number; mapping: Record<string, string>; fields: { key: string; label: string; required?: boolean }[]; notes: string; ai: boolean }

/** Lee el archivo y propone qué columna corresponde a cada dato. Con la cuenta de Claude de Báltica lo resuelve Claude; si no, por nombre de columna. */
export async function analyzeFile(kind: Kind, form: FormData): Promise<{ ok: true; analysis: Analysis } | { ok: false; error: string }> {
  await requireUser('duena')
  const file = form.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'Elegí el archivo exportado de Empretienda' }
  const t = await parseTable(file).catch(() => null)
  if (!t || !t.rows.length) return { ok: false, error: 'No pudimos leer el archivo. Tiene que ser el Excel (.xlsx) o CSV exportado de Empretienda.' }
  const fields = FIELDS[kind].map(({ key, label, required }) => ({ key, label, required }))
  let mapping = guessMapping(kind, t.headers), notes = '', ai = false
  const settings = await getSettings()
  if (settings.aiInvoices && await getAnthropicKey()) {
    try {
      const r = await mapColumns(`${kind} de Empretienda`, fields, t.headers, t.rows.slice(0, 5))
      mapping = { ...mapping, ...r.mapping }; notes = r.notes; ai = true
    } catch (e) { notes = e instanceof AiUnavailable ? e.message + ' Se usó la detección automática.' : 'Claude no respondió; se usó la detección automática.' }
  }
  return { ok: true, analysis: { headers: t.headers, sample: t.rows.slice(0, 3), count: t.rows.length, mapping, fields, notes, ai } }
}

function findCategory(catText: string, subText: string) {
  const parts = catText.split(/>|\/|,/).map(s => s.trim()).filter(Boolean)
  const [c0, c1] = [parts[0] ?? '', subText || parts[1] || '']
  const cat = CATEGORIES.find(c => norm(c.name) === norm(c0) || c.slug === slugify(c0))
  const sub = cat?.children?.find(s => norm(s.name) === norm(c1) || s.slug === slugify(c1) || s.slug === `${cat.slug}-${slugify(c1)}`)
  return { category: cat?.slug ?? (slugify(c0) || 'productos'), subcategory: sub?.slug ?? null, known: !!cat }
}

const yes = (v: string | undefined) => !v || /^(s|si|sí|yes|true|1|visible|publicado|activo)/i.test(v.trim())

export async function runImport(kind: Kind, form: FormData, mapping: Record<string, string>): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  const u = await requireUser('duena')
  const file = form.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'Falta el archivo' }
  const missing = FIELDS[kind].filter(f => f.required && !mapping[f.key])
  if (missing.length) return { ok: false, error: `Falta indicar la columna de: ${missing.map(f => f.label).join(', ')}` }
  const { rows } = await parseTable(file)
  const get = (r: Record<string, string>, k: string) => mapping[k] ? (r[mapping[k]] ?? '').trim() : ''
  let summary: string
  if (kind === 'productos') summary = await importProducts(rows, get, u.name)
  else if (kind === 'clientes') summary = await importCustomers(rows, get)
  else summary = await importSales(rows, get)
  revalidatePath('/', 'layout')
  return { ok: true, summary }
}

type Getter = (r: Record<string, string>, k: string) => string

async function uniqueBarcode() {
  for (;;) {
    const code = ean13('779' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'))
    const [dup] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.barcode, code))
    if (!dup) return code
  }
}

async function importProducts(rows: Record<string, string>[], get: Getter, by: string) {
  // Empretienda exporta una fila por variante: se agrupan por ID (o por nombre)
  const groups = new Map<string, Record<string, string>[]>()
  for (const r of rows) { const k = get(r, 'externalId') || norm(get(r, 'name')); if (!k) continue; groups.set(k, [...(groups.get(k) ?? []), r]) }
  let created = 0, updated = 0, unknownCats = 0, noCost = 0
  for (const rs of groups.values()) {
    const r = rs[0]
    const name = get(r, 'name'); const price = parseMoney(get(r, 'price'))
    if (!name || !price) continue
    const { category, subcategory, known } = findCategory(get(r, 'category'), get(r, 'subcategory'))
    if (!known) unknownCats++
    const options = [...new Set(rs.map(x => get(x, 'variantValue')).filter(Boolean))]
    const attr = get(r, 'variantAttr') || 'Opción'
    const stock = Math.max(0, Math.round(rs.reduce((a, x) => a + (parseMoney(get(x, 'stock')) ?? 0), 0)))
    const images = [...new Set(rs.flatMap(x => get(x, 'images').split(/[\s,;|]+/)).filter(s => /^https?:\/\//.test(s)))]
    const sku = get(r, 'sku'); const externalId = get(r, 'externalId') || null
    const cost = parseMoney(get(r, 'cost'))
    const values = {
      name, category, subcategory, price: Math.round(price),
      offerPrice: (() => { const o = parseMoney(get(r, 'offerPrice')); return o && o < price ? Math.round(o) : null })(),
      offerEndsAt: parseDate(get(r, 'offerEndsAt')),
      wholesalePrice: (() => { const w = parseMoney(get(r, 'wholesalePrice')); return w ? Math.round(w) : null })(),
      description: get(r, 'description') || null, variants: options.length ? { attr, options } : null, active: yes(get(r, 'visible')), externalId,
      ...(images.length ? { image: images[0], images } : {}),
      ...(cost ? { cost: Math.round(cost) } : {}),
    }
    const slug = slugify(name)
    const [existing] = await db.select().from(schema.products).where(or(
      externalId ? eq(schema.products.externalId, externalId) : sql`false`,
      sku ? eq(schema.products.sku, sku) : sql`false`,
      eq(schema.products.slug, slug),
    ))
    await db.transaction(async tx => {
      if (existing) {
        // No pisar fotos ya descargadas a la base con las URLs viejas de Empretienda
        const keepImages = existing.image.startsWith('/img/')
        await tx.update(schema.products).set({ ...values, ...(keepImages ? { image: existing.image, images: existing.images } : {}), deleted: false }).where(eq(schema.products.id, existing.id))
        if (stock !== existing.stock) await moveStock(tx, existing.id, stock - existing.stock, 'migracion', by, 'Empretienda')
        updated++
        if (!existing.cost && !cost) noCost++
      } else {
        const id = 'p' + randomUUID().slice(0, 8)
        const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.products)
        await tx.insert(schema.products).values({
          id, slug: (await tx.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.slug, slug))).length ? `${slug}-${id.slice(1, 5)}` : slug,
          ...values, image: images[0] ?? '', images, cost: cost ? Math.round(cost) : 0, stock: 0,
          sku: sku || `BA-${category.slice(0, 3).toUpperCase()}-${String(n + 1).padStart(3, '0')}`,
          barcode: get(r, 'barcode') || await uniqueBarcode(),
        })
        if (stock) await moveStock(tx, id, stock, 'migracion', by, 'Empretienda')
        created++
        if (!cost) noCost++
      }
    })
  }
  const extra = [unknownCats && `${unknownCats} con una categoría que no está en el menú (revisalas en Productos)`, noCost && `${noCost} sin costo cargado (completalo para ver ganancias reales)`].filter(Boolean)
  return `${created} productos nuevos y ${updated} actualizados.${extra.length ? ' Ojo: ' + extra.join('; ') + '.' : ''}`
}

async function importCustomers(rows: Record<string, string>[], get: Getter) {
  let n = 0
  for (const r of rows) {
    const name = get(r, 'name'); if (!name) continue
    const email = get(r, 'email').toLowerCase() || null
    const values = { name, email, phone: get(r, 'phone') || null, city: get(r, 'city') || null, wholesale: mapYes(get(r, 'wholesale')), source: 'empretienda' }
    if (email) await db.insert(schema.customers).values(values).onConflictDoUpdate({ target: schema.customers.email, set: { name, phone: values.phone, city: values.city, wholesale: values.wholesale } })
    else await db.insert(schema.customers).values(values)
    n++
  }
  return `${n} clientes importados o actualizados.`
}
const mapYes = (v: string) => /^(s|si|sí|yes|true|1|aprobad)/i.test(v.trim())

function mapStatus(s: string) {
  const v = norm(s)
  if (v.includes('cancel') || v.includes('rechaz') || v.includes('anulad')) return 'cancelada'
  if (v.includes('entreg') || v.includes('finaliz') || v.includes('complet')) return 'entregada'
  if (v.includes('envi') || v.includes('despach')) return 'enviada'
  if (v.includes('pend') || v.includes('espera')) return 'pendiente'
  return 'pagada'
}
function mapPayment(s: string) {
  const v = norm(s)
  return v.includes('mercado') ? 'mercadopago' : v.includes('transf') ? 'transferencia' : v.includes('efectivo') ? 'efectivo' : v.includes('debito') ? 'debito' : v.includes('credito') || v.includes('tarjeta') ? 'credito' : 'transferencia'
}

async function importSales(rows: Record<string, string>[], get: Getter) {
  // Producto oculto para renglones históricos que no se encuentran en el catálogo actual
  await db.insert(schema.products).values({ id: 'historico', slug: 'historico-empretienda', name: 'Producto histórico (Empretienda)', category: 'historico', price: 1, sku: 'HIST', barcode: 'HIST', active: false, deleted: true }).onConflictDoNothing()
  const products = await db.select({ id: schema.products.id, name: schema.products.name, cost: schema.products.cost }).from(schema.products).where(eq(schema.products.deleted, false))
  const byName = new Map(products.map(p => [norm(p.name), p]))
  const groups = new Map<string, Record<string, string>[]>()
  for (const r of rows) { const k = get(r, 'number'); if (k) groups.set(k, [...(groups.get(k) ?? []), r]) }
  let created = 0, skipped = 0
  for (const [num, rs] of groups) {
    const r = rs[0]
    const note = `Empretienda #${num}`
    const [dup] = await db.select({ n: schema.sales.number }).from(schema.sales).where(eq(schema.sales.note, note))
    if (dup) { skipped++; continue }
    const date = parseDate(get(r, 'date')); const total = parseMoney(get(r, 'total'))
    if (!date || total == null) continue
    const shipping = Math.round(parseMoney(get(r, 'shipping')) ?? 0)
    const items = rs.filter(x => get(x, 'productName')).map(x => {
      const pname = get(x, 'productName'); const p = byName.get(norm(pname))
      const qty = Math.max(1, Math.round(parseMoney(get(x, 'qty')) ?? 1))
      return { productId: p?.id ?? 'historico', name: pname, qty, unitPrice: Math.round(parseMoney(get(x, 'unitPrice')) ?? 0), unitCost: p?.cost ?? 0 }
    })
    if (!items.length) items.push({ productId: 'historico', name: `Venta Empretienda #${num}`, qty: 1, unitPrice: Math.round(total - shipping), unitCost: 0 })
    const subtotal = items.reduce((a, i) => a + i.qty * i.unitPrice, 0)
    const status = mapStatus(get(r, 'status'))
    await db.transaction(async tx => {
      const [s] = await tx.insert(schema.sales).values({
        channel: 'online', createdAt: date, subtotal, discount: Math.max(0, subtotal + shipping - Math.round(total)), shipping, total: Math.round(total),
        payment: mapPayment(get(r, 'payment')), status, note,
        customer: get(r, 'customerName') ? { name: get(r, 'customerName'), email: get(r, 'email') || undefined, phone: get(r, 'phone') || undefined, city: get(r, 'city') || undefined } : null,
        // El stock importado de Empretienda ya refleja estas ventas: no se descuenta de nuevo
        stockApplied: status !== 'cancelada' && status !== 'pendiente',
      }).returning({ number: schema.sales.number })
      await tx.insert(schema.saleItems).values(items.map(i => ({ ...i, saleNumber: s.number })))
    })
    created++
  }
  return `${created} ventas importadas${skipped ? `, ${skipped} ya estaban` : ''}.`
}

/** Descarga a la base las fotos que todavía apuntan a Empretienda. Se llama en tandas hasta que no quede ninguna. */
export async function importImagesBatch(): Promise<{ done: number; remaining: number; failed: number }> {
  await requireUser('duena')
  const pending = await db.select({ id: schema.products.id, image: schema.products.image, images: schema.products.images }).from(schema.products)
    .where(and(eq(schema.products.deleted, false), like(schema.products.image, 'http%'))).limit(8)
  let done = 0, failed = 0
  for (const p of pending) {
    const urls = p.images.length ? p.images : [p.image]
    const local: string[] = []
    for (const url of urls) {
      if (!url.startsWith('http')) { local.push(url); continue }
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
        if (!res.ok) throw new Error(String(res.status))
        const id = randomUUID()
        await db.insert(schema.images).values({ id, contentType: res.headers.get('content-type') ?? 'image/jpeg', data: Buffer.from(await res.arrayBuffer()) })
        local.push(`/img/${id}`)
      } catch { failed++ }
    }
    // Si alguna falló se deja la URL original para reintentar en otra pasada
    if (local.length === urls.length) { await db.update(schema.products).set({ image: local[0], images: local }).where(eq(schema.products.id, p.id)); done++ }
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.products).where(and(eq(schema.products.deleted, false), like(schema.products.image, 'http%')))
  if (done) revalidatePath('/', 'layout')
  return { done, remaining: n, failed }
}

export async function migrationStatus() {
  await requireUser('duena')
  const [p] = await db.select({ total: sql<number>`count(*)::int`, external: sql<number>`count(*) filter (where ${schema.products.image} like 'http%')::int`, noCost: sql<number>`count(*) filter (where ${schema.products.cost} = 0)::int` }).from(schema.products).where(eq(schema.products.deleted, false))
  const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.customers)
  const [s] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.sales).where(like(schema.sales.note, 'Empretienda #%'))
  return { products: p.total, externalImages: p.external, noCost: p.noCost, customers: c.n, importedSales: s.n }
}
