// Precio vigente: la oferta vale sólo si existe, es menor al precio y no venció.
interface Priced { price: number; offerPrice?: number | null; offerEndsAt?: string | Date | null }

export function offerActive(p: Priced, now = new Date()) {
  if (!p.offerPrice || p.offerPrice >= p.price) return false
  return !p.offerEndsAt || new Date(p.offerEndsAt) > now
}
export const currentPrice = (p: Priced, now = new Date()) => offerActive(p, now) ? p.offerPrice! : p.price
/** "20" para mostrar "20% OFF" */
export const offerPct = (p: Priced) => offerActive(p) ? Math.round((1 - p.offerPrice! / p.price) * 100) : 0

/** "26/10 23:59" en hora argentina, idéntico en servidor y navegador (toLocaleString varía entre motores). */
export function offerEndLabel(iso: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
  const v = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${v('day')}/${v('month')} ${v('hour')}:${v('minute')}`
}
