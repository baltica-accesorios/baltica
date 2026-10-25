import type { Product } from './types'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Búsqueda del panel: código exacto primero, después nombre que empieza, contiene, y SKU. */
export const findProduct = (products: Product[], q: string) => {
  const s = norm(q.trim())
  if (!s) return []
  const score = (p: Product) => { const n = norm(p.name); return p.barcode === s || p.sku.toLowerCase() === s ? 0 : n.startsWith(s) ? 1 : n.includes(s) ? 2 : p.sku.toLowerCase().includes(s) ? 3 : 9 }
  return products.map(p => [p, score(p)] as const).filter(([, sc]) => sc < 9).sort((a, b) => a[1] - b[1]).slice(0, 12).map(([p]) => p)
}

export const byCode = (products: Product[], code: string) => {
  const c = code.trim().toLowerCase()
  return products.find(p => p.barcode === c || p.sku.toLowerCase() === c)
}
