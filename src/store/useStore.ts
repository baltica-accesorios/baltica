import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product, Sale, SaleItem, StockMovement, Purchase, Settings, LabelTemplate, PaymentMethod, Channel, MovementReason } from '../lib/types'
import { buildProducts, buildHistory, buildPurchases } from './seed'
import { uid, ean13 } from '../lib/format'

export interface CartLine { productId: string; qty: number; variant?: string }

interface State {
  version: number
  products: Product[]
  sales: Sale[]
  movements: StockMovement[]
  purchases: Purchase[]
  settings: Settings
  labelTemplates: LabelTemplate[]
  nextNumber: number
  cart: CartLine[]
  // acciones
  addToCart: (line: CartLine) => void
  updateCart: (productId: string, variant: string | undefined, qty: number) => void
  clearCart: () => void
  checkoutOnline: (customer: Sale['customer'], payment: PaymentMethod) => Sale | { error: string }
  registerSale: (items: SaleItem[], opts: { channel: Channel; payment: PaymentMethod; discount?: number; customer?: Sale['customer']; seller?: string; note?: string }) => Sale
  updateSaleStatus: (id: string, status: Sale['status']) => void
  adjustStock: (productId: string, delta: number, reason: MovementReason, by?: string, ref?: string) => void
  upsertProduct: (p: Product) => void
  deleteProduct: (id: string) => void
  bulkPriceUpdate: (ids: string[], pctChange: number) => void
  addPurchase: (p: Purchase) => void
  confirmPurchase: (id: string, applyPrices: boolean) => void
  setSettings: (s: Partial<Settings>) => void
  upsertTemplate: (t: LabelTemplate) => void
  newBarcode: () => string
  reset: () => void
}

const DEFAULT_TEMPLATES: LabelTemplate[] = [
  { id: 't1', name: 'Joyería colgante 22×12', widthMm: 22, heightMm: 12, cols: 4, showPrice: true, showName: false, showSku: true, description: 'Etiqueta tipo "rat tail" para anillos y argollas. Código chico, precio grande.' },
  { id: 't2', name: 'Estándar 50×25', widthMm: 50, heightMm: 25, cols: 2, showPrice: true, showName: true, showSku: true, description: 'Para cajas, alhajeros y perfumeros. Nombre, precio y código.' },
  { id: 't3', name: 'Hoja A4 (65 etiquetas)', widthMm: 38, heightMm: 21, cols: 5, showPrice: true, showName: true, showSku: false, description: 'Impresora común con hoja autoadhesiva Pimaco/Avery 38×21.' },
  { id: 't4', name: 'Sin precio 30×20', widthMm: 30, heightMm: 20, cols: 3, showPrice: false, showName: true, showSku: true, description: 'Para mayoristas o cuando el precio cambia seguido.' },
]

const DEFAULT_SETTINGS: Settings = { storeName: 'Báltica Accesorios', defaultMarkup: 120, roundTo: 100, lowStockThreshold: 2, sellers: ['Sol', 'Nati'], aiInvoices: true, anthropicKey: '' }

function initial() {
  const products = buildProducts()
  const { sales, movements, nextNumber } = buildHistory(products)
  // El stock semilla es el stock actual; los movimientos históricos son informativos
  return { version: 6, products, sales, movements, purchases: buildPurchases(products), settings: DEFAULT_SETTINGS, labelTemplates: DEFAULT_TEMPLATES, nextNumber, cart: [] as CartLine[] }
}

export const useStore = create<State>()(persist((set, get) => ({
  ...initial(),

  addToCart: (line) => set(s => {
    const i = s.cart.findIndex(c => c.productId === line.productId && c.variant === line.variant)
    if (i >= 0) { const cart = [...s.cart]; cart[i] = { ...cart[i], qty: cart[i].qty + line.qty }; return { cart } }
    return { cart: [...s.cart, line] }
  }),
  updateCart: (productId, variant, qty) => set(s => ({ cart: s.cart.map(c => c.productId === productId && c.variant === variant ? { ...c, qty } : c).filter(c => c.qty > 0) })),
  clearCart: () => set({ cart: [] }),

  checkoutOnline: (customer, payment) => {
    const s = get()
    // Chequeo de stock al momento de confirmar (en producción esto es una transacción en el backend)
    for (const c of s.cart) {
      const p = s.products.find(p => p.id === c.productId)!
      if (p.stock < c.qty) return { error: `Sin stock suficiente de "${p.name}" (quedan ${p.stock})` }
    }
    const items: SaleItem[] = s.cart.map(c => { const p = s.products.find(p => p.id === c.productId)!; return { productId: p.id, name: p.name, qty: c.qty, unitPrice: p.offerPrice ?? p.price, unitCost: p.cost, variant: c.variant } })
    const sale = get().registerSale(items, { channel: 'online', payment, customer })
    set({ cart: [] })
    return sale
  },

  registerSale: (items, opts) => {
    const s = get()
    const subtotal = items.reduce((a, i) => a + i.qty * i.unitPrice, 0)
    const discount = opts.discount ?? 0
    const sale: Sale = { id: 's' + s.nextNumber, number: s.nextNumber, channel: opts.channel, createdAt: new Date().toISOString(), items, subtotal, discount, total: subtotal - discount, payment: opts.payment, status: opts.channel === 'local' ? 'pagada' : 'pendiente', customer: opts.customer, seller: opts.seller, note: opts.note }
    const movements = items.map(i => ({ id: uid(), productId: i.productId, delta: -i.qty, reason: (opts.channel === 'local' ? 'venta_local' : 'venta_online') as MovementReason, ref: sale.id, createdAt: sale.createdAt, by: opts.seller ?? 'tienda online' }))
    set({ sales: [...s.sales, sale], nextNumber: s.nextNumber + 1, movements: [...s.movements, ...movements], products: s.products.map(p => { const it = items.filter(i => i.productId === p.id); return it.length ? { ...p, stock: p.stock - it.reduce((a, i) => a + i.qty, 0) } : p }) })
    return sale
  },
  updateSaleStatus: (id, status) => set(s => {
    const sale = s.sales.find(x => x.id === id)
    if (!sale) return {}
    let products = s.products, movements = s.movements
    if (status === 'cancelada' && sale.status !== 'cancelada') {
      // Cancelar devuelve el stock
      products = products.map(p => { const it = sale.items.filter(i => i.productId === p.id); return it.length ? { ...p, stock: p.stock + it.reduce((a, i) => a + i.qty, 0) } : p })
      movements = [...movements, ...sale.items.map(i => ({ id: uid(), productId: i.productId, delta: i.qty, reason: 'devolucion' as MovementReason, ref: sale.id, createdAt: new Date().toISOString(), by: 'admin' }))]
    }
    return { sales: s.sales.map(x => x.id === id ? { ...x, status } : x), products, movements }
  }),
  adjustStock: (productId, delta, reason, by = 'admin', ref) => set(s => ({
    products: s.products.map(p => p.id === productId ? { ...p, stock: Math.max(0, p.stock + delta) } : p),
    movements: [...s.movements, { id: uid(), productId, delta, reason, ref, createdAt: new Date().toISOString(), by }],
  })),
  upsertProduct: (p) => set(s => ({ products: s.products.some(x => x.id === p.id) ? s.products.map(x => x.id === p.id ? p : x) : [p, ...s.products] })),
  deleteProduct: (id) => set(s => ({ products: s.products.filter(p => p.id !== id) })),
  bulkPriceUpdate: (ids, pctChange) => set(s => ({ products: s.products.map(p => ids.includes(p.id) ? { ...p, price: Math.round(p.price * (1 + pctChange / 100) / s.settings.roundTo) * s.settings.roundTo } : p) })),
  addPurchase: (p) => set(s => ({ purchases: [p, ...s.purchases] })),
  confirmPurchase: (id, applyPrices) => set(s => {
    const pu = s.purchases.find(p => p.id === id); if (!pu) return {}
    const now = new Date().toISOString()
    const movements = [...s.movements]
    let products = s.products
    for (const l of pu.lines) {
      if (!l.productId) continue
      movements.push({ id: uid(), productId: l.productId, delta: l.qty, reason: 'compra', ref: pu.id, createdAt: now, by: 'admin' })
      products = products.map(p => p.id === l.productId ? { ...p, stock: p.stock + l.qty, cost: l.unitCost, markupPct: l.markupPct, price: applyPrices ? l.suggestedPrice : p.price } : p)
    }
    return { products, movements, purchases: s.purchases.map(p => p.id === id ? { ...p, status: 'confirmada' } : p) }
  }),
  setSettings: (patch) => set(s => ({ settings: { ...s.settings, ...patch } })),
  upsertTemplate: (t) => set(s => ({ labelTemplates: s.labelTemplates.some(x => x.id === t.id) ? s.labelTemplates.map(x => x.id === t.id ? t : x) : [...s.labelTemplates, t] })),
  newBarcode: () => { const n = get().products.length + 1 + Math.floor(Math.random() * 900); return ean13('779' + String(n).padStart(9, '0')) },
  reset: () => set({ ...initial() }),
}), {
  name: 'baltica-proto-v6',
  version: 6,
  migrate: () => initial() as unknown as State,
}))

// Selectores útiles
export const findProduct = (products: Product[], q: string) => {
  const s = q.trim().toLowerCase()
  if (!s) return []
  const score = (p: Product) => p.barcode === s || p.sku.toLowerCase() === s ? 0 : p.name.toLowerCase().startsWith(s) ? 1 : p.name.toLowerCase().includes(s) ? 2 : p.sku.toLowerCase().includes(s) ? 3 : 9
  return products.map(p => [p, score(p)] as const).filter(([, sc]) => sc < 9).sort((a, b) => a[1] - b[1]).slice(0, 12).map(([p]) => p)
}
