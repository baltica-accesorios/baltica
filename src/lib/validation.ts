import { z } from 'zod'
const amount = z.number().int().min(0).max(2_000_000_000)
const slug = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const image = z.string().max(2048).refine(s => !s || /^\/(?!\/)/.test(s) || /^https:\/\//.test(s), 'Usá una imagen local o HTTPS')
const href = z.string().max(2048).refine(s => /^\/(?!\/)/.test(s) || /^https:\/\//.test(s), 'Usá una dirección local o HTTPS')
const date = z.string().refine(s => Number.isFinite(Date.parse(s)), 'Fecha inválida').nullable().optional()
const attribute = z.object({ catalogId: z.string().optional(), type: z.enum(['text', 'color']).optional(), colors: z.record(z.string(), z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(), attr: z.string().trim().min(1).max(80), options: z.array(z.string().trim().min(1).max(80).refine(s => !s.includes(' / '), 'No uses / como separador dentro de una opción')).min(1).max(100) })
export const productInput = z.object({
  id: z.string().min(1).max(120), slug: z.string().max(200), name: z.string().trim().min(1).max(300), category: slug, subcategory: slug.nullable().optional(), material: z.string().max(120),
  price: amount.min(1), cost: amount, stock: amount, sku: z.string().max(120), barcode: z.string().max(100), image,
  images: z.array(image).max(30).optional(), description: z.string().max(20000).nullable().optional(),
  offerPrice: amount.nullable().optional(), offerEndsAt: date, wholesalePrice: amount.nullable().optional(), minStock: amount.nullable().optional(), markupPct: z.number().min(0).max(10000).nullable().optional(),
  variants: z.object({ attr: z.string().min(1), options: z.array(z.string().min(1)).min(1).max(500), attributes: z.array(attribute).max(5).optional(), details: z.record(z.string(), z.object({ price: amount.min(1).optional(), image: image.optional(), images: z.array(image).max(30).optional() })).optional() }).nullable().optional(),
  variantStock: z.record(z.string(), amount).nullable().optional(), createdAt: z.string(), active: z.boolean().optional(),
})
export const attributeDefinition = z.object({
  id: z.string().min(1).max(100), name: z.string().trim().min(1).max(80), type: z.enum(['text', 'color']),
  values: z.array(z.object({ label: z.string().trim().min(1).max(80).refine(s => !s.includes(' / '), 'No uses / como separador dentro de una opción'), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() })).min(1).max(100),
}).refine(a => a.type !== 'color' || a.values.every(v => v.color), 'Elegí un color para cada opción')
export const settingsPatch = z.object({
  attributes: z.array(attributeDefinition).max(100),
  storeName: z.string().trim().min(1).max(120), defaultMarkup: z.number().min(0).max(10000), roundTo: z.number().int().min(1), lowStockThreshold: amount,
  sellers: z.array(z.string().max(100)).max(100), aiInvoices: z.boolean(), transferDiscountPct: z.number().min(0).max(100), transferInfo: z.string().max(10000), cashOnPickup: z.boolean(),
  shippingOptions: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), price: amount, description: z.string(), kind: z.enum(['fijo', 'correo_domicilio', 'correo_sucursal']).optional(), zips: z.string().optional() })).min(1).max(50),
  parcel: z.object({ originZip: z.string().regex(/^\d{4}$/), baseWeightG: z.number().int().min(1).max(25000), itemWeightG: amount, lengthCm: z.number().min(1).max(200), widthCm: z.number().min(1).max(200), heightCm: z.number().min(1).max(200) }),
  whatsapp: z.string().max(40), email: z.string().max(200), instagram: href, announcement: z.string().max(1000), gaId: z.string().max(100),
  categories: z.array(z.object({ slug, name: z.string().trim().min(1).max(100), image: image.optional(), href: href.optional(), tileTitle: z.string().max(100).optional(), children: z.array(z.object({ slug, name: z.string().trim().min(1).max(100) })).max(100).optional() })).max(200),
  materials: z.array(z.string().trim().min(1).max(100)).max(200), banners: z.array(z.object({ image: image.refine(Boolean, 'Cargá la imagen del banner'), href, alt: z.string().max(300) })).max(20), homeTitle: z.string().max(100), mobileCategoryColumns: z.number().int().min(1).max(3), desktopCategoryColumns: z.number().int().min(1).max(4),
  promotions: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), type: z.enum(['pct', '2x1']), value: z.number().min(0).max(99), active: z.boolean(), category: z.string().optional(), productIds: z.array(z.string()).max(10000).optional(), startsAt: date, endsAt: date, roundTo: z.number().int().min(1).max(10000).optional() }).refine(p => !p.startsAt || !p.endsAt || new Date(p.startsAt) < new Date(p.endsAt), 'El fin debe ser posterior al inicio').refine(p => p.type !== 'pct' || p.value > 0, 'El porcentaje debe ser mayor a cero')).max(100),
}).partial().strict()
