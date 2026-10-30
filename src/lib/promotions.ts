import type { Product, Promotion } from './types'
import { currentPrice } from './pricing'
export function activePromotion(p: Promotion, now = new Date()) { return p.active && (!p.startsAt || new Date(p.startsAt) <= now) && (!p.endsAt || new Date(p.endsAt) > now) }
export function promotionMatches(p: Promotion, product: { id: string; category: string }) { return (!p.category || p.category === product.category) && (!p.productIds?.length || p.productIds.includes(product.id)) }
export function promotionalProduct(product: Product, promotions: Promotion[]): Product {
  let best = currentPrice(product), ends = product.offerEndsAt
  for (const rule of promotions.filter(p => p.type === 'pct' && activePromotion(p) && promotionMatches(p, product))) {
    const step = rule.roundTo || 1
    const price = Math.max(1, Math.round(product.price * (1 - rule.value / 100) / step) * step)
    if (price < best) { best = price; ends = rule.endsAt }
  }
  return best < product.price ? { ...product, offerPrice: best, offerEndsAt: ends } : product
}
// Rules do not stack: a unit participates in the first matching 2x1 only.
// Each pair within the promotion gives the cheaper unit free (including mixed products).
export function twoForOneDiscount(lines: { productId: string; category: string; qty: number; price: number }[], promotions: Promotion[]) {
  const used = new Set<number>(); let discount = 0
  for (const rule of promotions.filter(p => p.type === '2x1' && activePromotion(p))) {
    const prices: number[] = []
    lines.forEach((l, index) => { if (!used.has(index) && promotionMatches(rule, { id: l.productId, category: l.category })) { used.add(index); for (let n = 0; n < l.qty; n++) prices.push(l.price) } })
    prices.sort((a, b) => b - a)
    for (let i = 1; i < prices.length; i += 2) discount += prices[i]
  }
  return discount
}
