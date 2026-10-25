// Envíos por código postal. Opciones fijas configurables (con zonas por CP) y, si Báltica carga sus
// credenciales de MiCorreo, cotización en vivo de Correo Argentino. Si la cotización falla se usa el
// precio fijo de respaldo: el checkout nunca se cae por el Correo.
import { getSettings } from './data'
import type { Parcel, ShippingOption } from './types'

export interface Quote { id: string; name: string; price: number; description: string; live: boolean; days?: string }

export const cleanZip = (z: string) => (z.match(/\d{4}/)?.[0] ?? '')

/** "2900, 2901-2905, 29*" → ¿incluye este CP? Vacío = todos. */
export function zipMatches(rule: string | undefined, zip: string) {
  if (!rule?.trim()) return true
  const n = Number(zip)
  return rule.split(/[,;\s]+/).filter(Boolean).some(t => {
    if (t.endsWith('*')) return zip.startsWith(t.slice(0, -1))
    const [a, b] = t.split('-').map(Number)
    return b ? n >= a && n <= b : zip === String(a)
  })
}

// ---------- Correo Argentino (MiCorreo) ----------
const correoEnabled = () => !!(process.env.CORREO_API_USER && process.env.CORREO_API_PASSWORD && process.env.CORREO_EMAIL && process.env.CORREO_PASSWORD)
const correoBase = () => process.env.CORREO_ENV === 'prod' ? 'https://api.correoargentino.com.ar/micorreo/v1' : 'https://apitest.correoargentino.com.ar/micorreo/v1'
let auth: { token: string; expires: number; customerId: string } | null = null

async function correoAuth() {
  if (auth && auth.expires > Date.now() + 60000) return auth
  const basic = Buffer.from(`${process.env.CORREO_API_USER}:${process.env.CORREO_API_PASSWORD}`).toString('base64')
  const t = await fetch(`${correoBase()}/token`, { method: 'POST', headers: { Authorization: `Basic ${basic}` }, signal: AbortSignal.timeout(8000) })
  if (!t.ok) throw new Error(`Correo token ${t.status}`)
  const { token, expires } = await t.json() as { token: string; expires: string }
  const u = await fetch(`${correoBase()}/users/validate`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.CORREO_EMAIL, password: process.env.CORREO_PASSWORD }), signal: AbortSignal.timeout(8000) })
  if (!u.ok) throw new Error(`Correo validate ${u.status}`)
  const { customerId } = await u.json() as { customerId: string }
  auth = { token, customerId, expires: new Date(expires).getTime() || Date.now() + 30 * 60000 }
  return auth
}

async function correoRates(zip: string, units: number, parcel: Parcel) {
  const a = await correoAuth()
  const weight = Math.min(25000, Math.max(1, Math.round(parcel.baseWeightG + parcel.itemWeightG * units)))
  const res = await fetch(`${correoBase()}/rates`, {
    method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: a.customerId, postalCodeOrigin: parcel.originZip, postalCodeDestination: zip, dimensions: { weight, height: parcel.heightCm, width: parcel.widthCm, length: parcel.lengthCm } }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Correo rates ${res.status}`)
  const data = await res.json() as { rates: { deliveredType: 'D' | 'S'; productType: string; productName: string; price: number; deliveryTimeMin: string; deliveryTimeMax: string }[] }
  return data.rates
}

/** Opciones de envío para un CP y cantidad de unidades. Sin CP sólo se ofrecen las que valen para todo el país y no dependen del Correo. */
export async function quoteShipping(zipRaw: string, units: number): Promise<Quote[]> {
  const s = await getSettings()
  const zip = cleanZip(zipRaw)
  const opts = s.shippingOptions.filter(o => zip ? zipMatches(o.zips, zip) : (!o.zips?.trim() && (o.kind ?? 'fijo') === 'fijo'))
  let rates: Awaited<ReturnType<typeof correoRates>> | null = null
  if (zip && correoEnabled() && opts.some(o => o.kind?.startsWith('correo'))) {
    try { rates = await correoRates(zip, units, s.parcel) } catch (e) { console.error('Correo Argentino', e) }
  }
  return opts.map((o: ShippingOption) => {
    if (rates && (o.kind === 'correo_domicilio' || o.kind === 'correo_sucursal')) {
      const type = o.kind === 'correo_domicilio' ? 'D' : 'S'
      // La opción más barata de ese tipo (clásico antes que expreso)
      const r = rates.filter(x => x.deliveredType === type).sort((a, b) => a.price - b.price)[0]
      if (r) return { id: o.id, name: o.name, price: Math.ceil(r.price), description: o.description, live: true, days: r.deliveryTimeMin && r.deliveryTimeMax ? `${r.deliveryTimeMin} a ${r.deliveryTimeMax} días hábiles` : undefined }
    }
    return { id: o.id, name: o.name, price: o.price, description: o.description, live: false }
  })
}
