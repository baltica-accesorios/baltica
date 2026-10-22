export const money = (n: number) =>
  '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const moneyShort = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-AR')
export const pct = (n: number) => `${(n * 100).toFixed(0)}%`
export const dateAR = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
export const timeAR = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
export const dayKey = (iso: string) => iso.slice(0, 10)
export const uid = () => Math.random().toString(36).slice(2, 10)

export function ean13(body12: string) {
  const d = body12.split('').map(Number)
  const s = d.reduce((acc, v, i) => acc + v * (i % 2 === 0 ? 1 : 3), 0)
  return body12 + ((10 - (s % 10)) % 10)
}
export function isValidEan13(code: string) {
  return /^\d{13}$/.test(code) && ean13(code.slice(0, 12)) === code
}
export function roundTo(n: number, step: number) { return Math.round(n / step) * step }
