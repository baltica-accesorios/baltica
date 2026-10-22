import seedProducts from '../seed_products.json'
import type { Product, Sale, SaleItem, StockMovement, Purchase, PaymentMethod, Channel } from '../lib/types'

// Generador determinista (misma semilla => mismos datos en cada carga)
function rng(seed: number) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

export function buildProducts(): Product[] {
  return (seedProducts as unknown as Product[]).map(p => ({ ...p, active: true, minStock: 2, images: [p.image] }))
}

const FIRST = ['Camila', 'Lucía', 'Valentina', 'Martina', 'Sofía', 'Julieta', 'Agustina', 'Florencia', 'Micaela', 'Carla', 'Rocío', 'Belén', 'Josefina', 'Paula', 'Romina']
const LAST = ['Pérez', 'Gómez', 'Rodríguez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Sánchez', 'Romero', 'Torres', 'Álvarez', 'Ruiz', 'Benítez']
const CITIES = ['San Nicolás', 'San Nicolás', 'San Nicolás', 'Rosario', 'Villa Constitución', 'Pergamino', 'CABA', 'Ramallo', 'La Plata', 'Córdoba']

export function buildHistory(products: Product[], days = 120) {
  const r = rng(20261021)
  const sales: Sale[] = []
  const movements: StockMovement[] = []
  const today = new Date('2026-10-21T18:30:00')
  let number = 1000
  const weights = products.map(p => (p.price < 5000 ? 3 : p.price < 10000 ? 2 : 1))
  const pick = () => {
    let t = r() * weights.reduce((a, b) => a + b, 0)
    for (let i = 0; i < products.length; i++) { t -= weights[i]; if (t <= 0) return products[i] }
    return products[0]
  }
  for (let d = days; d >= 0; d--) {
    const date = new Date(today); date.setDate(today.getDate() - d)
    const dow = date.getDay()
    // más ventas viernes/sábado, nada los domingos en el local
    const base = dow === 0 ? 1.2 : dow === 5 || dow === 6 ? 4.5 : 2.8
    const growth = 1 + (days - d) / days * 0.6
    const n = Math.round(base * growth * (0.6 + r() * 0.9))
    for (let k = 0; k < n; k++) {
      const channel: Channel = dow === 0 ? 'online' : r() < 0.55 ? 'local' : 'online'
      const h = channel === 'local' ? 10 + Math.floor(r() * 9) : 8 + Math.floor(r() * 15)
      const createdAt = new Date(date); createdAt.setHours(h, Math.floor(r() * 60), 0, 0)
      if (createdAt > today) continue
      const itemsN = r() < 0.6 ? 1 : r() < 0.8 ? 2 : 3
      const items: SaleItem[] = []
      for (let i = 0; i < itemsN; i++) {
        const p = pick()
        const qty = r() < 0.85 ? 1 : 2
        items.push({ productId: p.id, name: p.name, qty, unitPrice: p.price, unitCost: p.cost, variant: p.variants ? p.variants.options[Math.floor(r() * p.variants.options.length)] : undefined })
      }
      const subtotal = items.reduce((a, i) => a + i.qty * i.unitPrice, 0)
      const discount = r() < 0.15 ? Math.round(subtotal * 0.1) : 0
      const payment: PaymentMethod = channel === 'local'
        ? (['efectivo', 'efectivo', 'transferencia', 'debito', 'qr'] as PaymentMethod[])[Math.floor(r() * 5)]
        : (['mercadopago', 'mercadopago', 'transferencia'] as PaymentMethod[])[Math.floor(r() * 3)]
      const id = `s${number}`
      const status = channel === 'local' ? 'pagada' : d < 2 ? (r() < 0.5 ? 'pendiente' : 'pagada') : d < 6 ? 'enviada' : 'entregada'
      const fn = FIRST[Math.floor(r() * FIRST.length)], ln = LAST[Math.floor(r() * LAST.length)]
      sales.push({
        id, number: number++, channel, createdAt: createdAt.toISOString(), items, subtotal, discount, total: subtotal - discount, payment, status,
        customer: channel === 'online' || r() < 0.3 ? { name: `${fn} ${ln}`, email: `${fn}.${ln}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@gmail.com', city: CITIES[Math.floor(r() * CITIES.length)] } : undefined,
        seller: channel === 'local' ? (r() < 0.6 ? 'Sol' : 'Nati') : undefined,
      })
      for (const it of items) movements.push({ id: `m${id}-${it.productId}`, productId: it.productId, delta: -it.qty, reason: channel === 'local' ? 'venta_local' : 'venta_online', ref: id, createdAt: createdAt.toISOString(), by: channel === 'local' ? 'Sol' : 'tienda online' })
    }
  }
  sales.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  movements.push({ id: 'm-migracion', productId: '*', delta: 0, reason: 'migracion', createdAt: new Date(today.getTime() - days * 86400000).toISOString(), by: 'Importación Empretienda' })
  return { sales, movements, nextNumber: number }
}

export function buildPurchases(products: Product[]): Purchase[] {
  const byCat = (c: string) => products.filter(p => p.category === c)
  const mk = (id: string, supplier: string, date: string, invoiceNumber: string, ps: Product[], source: 'foto' | 'manual'): Purchase => {
    const lines = ps.map(p => ({ productId: p.id, description: p.name, qty: 6, unitCost: p.cost, matched: true, suggestedPrice: p.price, barcode: p.barcode }))
    return { id, supplier, date, invoiceNumber, lines, total: lines.reduce((a, l) => a + l.qty * l.unitCost, 0), status: 'confirmada', source }
  }
  return [
    mk('c1', 'Plata Nativa SRL', '2026-09-12', 'A-0003-00018822', byCat('argollas').slice(0, 5), 'foto'),
    mk('c2', 'Acero & Co', '2026-10-02', 'B-0001-00004471', byCat('anillos').slice(0, 6), 'foto'),
    mk('c3', 'Dijes del Sur', '2026-10-15', 'B-0002-00000917', byCat('dijes').slice(0, 4), 'manual'),
  ]
}
