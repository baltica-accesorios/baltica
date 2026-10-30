import type { Sale, Product } from './types'

export const saleProfit = (s: Sale) => s.items.reduce((a, i) => a + i.qty * (i.unitPrice - i.unitCost), 0) - s.discount
export const saleCost = (s: Sale) => s.items.reduce((a, i) => a + i.qty * i.unitCost, 0)
// Ventas que cuentan: ni canceladas ni pedidos online sin pagar
export const valid = (s: Sale) => s.status !== 'cancelada' && !(s.channel === 'online' && s.status === 'pendiente' && s.payment === 'mercadopago')
// Lo cobrado por mercadería (el envío se cobra pero se paga al correo)
export const net = (s: Sale) => s.total - (s.shipping ?? 0)

export function inRange(sales: Sale[], from: Date, to: Date) {
  return sales.filter(s => valid(s) && new Date(s.createdAt) >= from && new Date(s.createdAt) <= to)
}
export function summary(sales: Sale[]) {
  const revenue = sales.reduce((a, s) => a + net(s), 0)
  const cost = sales.reduce((a, s) => a + saleCost(s), 0)
  const profit = revenue - cost
  const units = sales.reduce((a, s) => a + s.items.reduce((b, i) => b + i.qty, 0), 0)
  const days = new Set(sales.map(s => s.createdAt.slice(0, 10))).size
  return { revenue, cost, profit, units, count: sales.length, days, ticket: sales.length ? revenue / sales.length : 0, margin: revenue ? profit / revenue : 0 }
}
export function byDay(sales: Sale[], days: number, end = new Date()) {
  const out: { day: string; label: string; online: number; local: number; profit: number; count: number }[] = []
  for (let d = days - 1; d >= 0; d--) {
    const dt = new Date(end); dt.setDate(end.getDate() - d)
    const key = dt.toISOString().slice(0, 10)
    const ss = sales.filter(s => valid(s) && s.createdAt.slice(0, 10) === key)
    out.push({ day: key, label: dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }), online: ss.filter(s => s.channel === 'online').reduce((a, s) => a + net(s), 0), local: ss.filter(s => s.channel === 'local').reduce((a, s) => a + net(s), 0), profit: ss.reduce((a, s) => a + saleProfit(s), 0), count: ss.length })
  }
  return out
}
export function topProducts(sales: Sale[], products: Product[], n = 8) {
  const m = new Map<string, { qty: number; revenue: number; profit: number }>()
  sales.filter(valid).forEach(s => s.items.forEach(i => { const c = m.get(i.productId) ?? { qty: 0, revenue: 0, profit: 0 }; c.qty += i.qty; c.revenue += i.qty * i.unitPrice; c.profit += i.qty * (i.unitPrice - i.unitCost); m.set(i.productId, c) }))
  return [...m.entries()].map(([id, v]) => ({ product: products.find(p => p.id === id), ...v })).filter(x => x.product).sort((a, b) => b.qty - a.qty).slice(0, n)
}
export function byCategory(sales: Sale[], products: Product[]) {
  const m = new Map<string, number>()
  sales.filter(valid).forEach(s => s.items.forEach(i => { const p = products.find(p => p.id === i.productId); if (p) m.set(p.category, (m.get(p.category) ?? 0) + i.qty * i.unitPrice) }))
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}
export function byWeekday(sales: Sale[]) {
  const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const out = names.map(n => ({ name: n, total: 0, count: 0 }))
  sales.filter(valid).forEach(s => { const d = new Date(s.createdAt).getDay(); out[d].total += net(s); out[d].count++ })
  return out
}
export function byHour(sales: Sale[]) {
  const out = Array.from({ length: 24 }, (_, h) => ({ h: `${h}h`, count: 0 }))
  sales.filter(valid).forEach(s => { out[new Date(s.createdAt).getHours()].count++ })
  return out.filter((_, h) => h >= 8 && h <= 22)
}
export function byPayment(sales: Sale[]) {
  const m = new Map<string, number>()
  sales.filter(valid).forEach(s => m.set(s.payment, (m.get(s.payment) ?? 0) + net(s)))
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}
export function stockValue(products: Product[]) {
  return { cost: products.reduce((a, p) => a + p.stock * p.cost, 0), retail: products.reduce((a, p) => a + p.stock * p.price, 0), units: products.reduce((a, p) => a + p.stock, 0) }
}
// Días de cobertura: stock actual / ventas promedio diarias de los últimos 30 días
export function dailyRate(p: Product, sales: Sale[]) {
  const since = Date.now() - 30 * 86400000
  const sold = sales.filter(s => valid(s) && new Date(s.createdAt).getTime() > since).reduce((a, s) => a + s.items.filter(i => i.productId === p.id).reduce((b, i) => b + i.qty, 0), 0)
  return sold / 30
}
export function coverageDays(p: Product, sales: Sale[]) {
  const rate = dailyRate(p, sales)
  if (!rate) return Infinity
  return p.stock / rate
}
// Cuántas unidades comprar para cubrir `days` días con un colchón de seguridad
export function reorderQty(p: Product, sales: Sale[], days = 30) {
  const rate = dailyRate(p, sales)
  if (!rate) return 0
  return Math.max(0, Math.ceil(rate * days) + 2 - p.stock)
}

export function filterSalesCategory(sales: Sale[], products: Product[], category: string): Sale[] {
  if (!category) return sales
  const ids = new Set(products.filter(p => p.category === category).map(p => p.id))
  return sales.flatMap(s => {
    const items = s.items.filter(i => ids.has(i.productId))
    if (!items.length) return []
    const subtotal = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)
    const discount = s.subtotal ? s.discount * subtotal / s.subtotal : 0
    return [{ ...s, items, subtotal, discount, shipping: 0, total: subtotal - discount }]
  })
}
