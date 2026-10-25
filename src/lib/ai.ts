// Funciones con Claude (opcionales). Usan la cuenta de Anthropic de Báltica: la clave se carga en
// Configuración y se paga por uso directamente a Anthropic. Sin clave, todo se puede cargar a mano.
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { getAnthropicKey } from './data'

const MODEL = 'claude-opus-5-5'

export class AiUnavailable extends Error {}

async function client() {
  const key = await getAnthropicKey()
  if (!key) throw new AiUnavailable('Falta cargar la clave de Claude en Configuración')
  return new Anthropic({ apiKey: key })
}

/** Pide una respuesta con forma fija (JSON validado) y maneja los errores típicos con mensajes entendibles. */
async function ask<T extends z.ZodType>(schema: T, system: string, content: Anthropic.Beta.BetaContentBlockParam[]): Promise<z.infer<T>> {
  const c = await client()
  try {
    const res = await c.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
      // Si el modelo principal declina por un falso positivo de seguridad, la API reintenta con otro modelo
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content }],
    })
    if (res.stop_reason === 'refusal' || !res.parsed_output) throw new AiUnavailable('Claude no pudo leer el archivo. Cargalo a mano.')
    return res.parsed_output
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiUnavailable('La clave de Claude no es válida. Revisala en Configuración.')
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiUnavailable('La cuenta de Claude no tiene permiso o se quedó sin saldo.')
    if (e instanceof Anthropic.RateLimitError) throw new AiUnavailable('Claude está saturado. Probá de nuevo en un minuto.')
    if (e instanceof Anthropic.BadRequestError && /credit|billing|balance/i.test(e.message)) throw new AiUnavailable('La cuenta de Claude se quedó sin saldo. Cargá crédito en console.anthropic.com.')
    if (e instanceof Anthropic.APIConnectionError) throw new AiUnavailable('No se pudo conectar con Claude. Revisá la conexión.')
    throw e
  }
}

// ---------- Facturas de proveedor ----------

const InvoiceSchema = z.object({
  supplier: z.string().describe('Razón social del proveedor, vacío si no se ve'),
  invoiceNumber: z.string().describe('Número de factura o remito, ej. B-0001-00004512; vacío si no hay'),
  date: z.string().describe('Fecha de la factura en formato AAAA-MM-DD; vacío si no se ve'),
  lines: z.array(z.object({
    description: z.string().describe('Texto del renglón tal como está en la factura'),
    qty: z.number().describe('Cantidad de unidades'),
    unitCost: z.number().describe('Costo final por unidad en pesos que paga el comercio (con IVA y descuentos aplicados)'),
    productId: z.string().nullable().describe('id del producto del catálogo que corresponde, o null si no hay uno claro'),
  })),
})
export type InvoiceReading = z.infer<typeof InvoiceSchema>

export async function readInvoice(file: { data: string; mediaType: string }, catalog: { id: string; name: string; sku: string; barcode: string; cost: number }[]) {
  const catalogText = catalog.map(p => `${p.id} | ${p.name} | ${p.sku} | ${p.barcode} | costo actual $${p.cost}`).join('\n')
  const system = `Leés facturas y remitos de proveedores de una tienda argentina de accesorios (bijou, plata, acero quirúrgico) y los convertís en renglones de compra.
Los proveedores abrevian: AQ / AC QUIR = acero quirúrgico, AC DOR = acero dorado, AC BCO = acero blanco, ARG = argollas, 925 = plata.
Si un renglón trae "x6" o un pack, la cantidad es el total de unidades y el costo es por unidad.
Si la factura discrimina IVA (factura A), sumá el IVA al costo unitario. Si hay descuento general, prorrateálo.
Para productId elegí sólo un producto del catálogo que sea claramente el mismo; ante la duda, null.

Catálogo (id | nombre | sku | código | costo):
${catalogText}`
  const doc: Anthropic.Beta.BetaContentBlockParam = file.mediaType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.data } }
    : { type: 'image', source: { type: 'base64', media_type: file.mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: file.data } }
  const out = await ask(InvoiceSchema, system, [doc, { type: 'text', text: 'Extraé todos los renglones de esta factura.' }])
  const ids = new Set(catalog.map(p => p.id))
  return { ...out, lines: out.lines.map(l => ({ ...l, productId: l.productId && ids.has(l.productId) ? l.productId : null })) }
}

// ---------- Migración: entender las columnas de un export ----------

const MappingSchema = z.object({
  mapping: z.array(z.object({ field: z.string(), column: z.string().nullable() })),
  notes: z.string().describe('Observaciones breves para la dueña, en castellano rioplatense, o vacío'),
})

/** Dado el encabezado y algunas filas de un Excel/CSV, decide qué columna corresponde a cada campo del sistema. */
export async function mapColumns(kind: string, fields: { key: string; label: string }[], headers: string[], sample: Record<string, unknown>[]) {
  const system = `Ayudás a migrar datos desde Empretienda (plataforma argentina de tiendas online) a un sistema propio.
Te paso las columnas de un archivo exportado de ${kind} y unas filas de ejemplo. Para cada campo del sistema indicá el nombre EXACTO de la columna del archivo que le corresponde, o null si no existe.`
  const text = `Campos del sistema:\n${fields.map(f => `- ${f.key}: ${f.label}`).join('\n')}\n\nColumnas del archivo:\n${headers.join(' | ')}\n\nFilas de ejemplo:\n${JSON.stringify(sample.slice(0, 5), null, 1)}`
  const out = await ask(MappingSchema, system, [{ type: 'text', text }])
  const valid = new Set(headers)
  return { mapping: Object.fromEntries(out.mapping.filter(m => m.column && valid.has(m.column)).map(m => [m.field, m.column!])) as Record<string, string>, notes: out.notes }
}
