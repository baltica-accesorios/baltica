import type { Variant, ProductAttribute, AttributeDefinition, PublicProduct } from './types'
export function combinationOptions(attributes: ProductAttribute[]) {
  const valid = attributes.filter(a => a.attr.trim() && a.options.length)
  if (!valid.length) return []
  if (valid.reduce((n, a) => n * a.options.length, 1) > 500) throw new Error('Máximo 500 combinaciones por producto')
  return valid.reduce<string[]>((rows, a) => rows.flatMap(row => a.options.map(o => row ? `${row} / ${o}` : o)), [''])
}
export function buildVariants(attributes: ProductAttribute[], previous?: Variant | null): Variant | null {
  const options = combinationOptions(attributes)
  return options.length ? { attr: attributes.map(a => a.attr).join(' / '), options, attributes, details: previous?.details } : null
}
export function variantPrice(p: { price: number; offerPrice?: number | null; offerEndsAt?: string | Date | null; variants?: Variant | null }, variant?: string | null) {
  const price = variant ? p.variants?.details?.[variant]?.price ?? p.price : p.price
  const offer = p.offerPrice && p.offerPrice < p.price && (!p.offerEndsAt || new Date(p.offerEndsAt) > new Date())
  return offer ? Math.round(price * p.offerPrice! / p.price) : price
}

export const attributeKey = (s: string) => s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function attributesOf(variants?: Variant | null): ProductAttribute[] {
  return variants?.attributes?.length ? variants.attributes : variants?.options.length ? [{ attr: variants.attr, options: variants.options }] : []
}
export function decorateAttributes<T extends { variants?: Variant | null }>(p: T, catalog: AttributeDefinition[]): T {
  if (!p.variants) return p
  const attributes = attributesOf(p.variants).map(a => {
    const definition = catalog.find(d => d.id === a.catalogId || attributeKey(d.name) === attributeKey(a.attr))
    if (!definition) return a
    return { ...a, catalogId: definition.id, type: definition.type, colors: { ...a.colors, ...Object.fromEntries(definition.values.filter(v => v.color).map(v => [v.label, v.color!])) } }
  })
  return { ...p, variants: { ...p.variants, attributes } }
}
type VariantProduct = Pick<PublicProduct, 'variants' | 'variantStock' | 'stock'>
export function variantAvailable(p: VariantProduct, key: string) {
  if (!p.variants?.options.includes(key)) return false
  return (p.variantStock ? p.variantStock[key] ?? 0 : p.stock) > 0
}
export function valuesForVariant(variants: Variant, key: string) {
  return attributesOf(variants).length === 1 ? [key] : key.split(' / ')
}
export type AttributeFilters = Record<string, string[]>
export function matchingVariants(p: VariantProduct, filters: AttributeFilters, inStock = true): string[] {
  const attrs = attributesOf(p.variants)
  if (!p.variants) return []
  return p.variants.options.filter(key => {
    if (inStock && !variantAvailable(p, key)) return false
    const values = valuesForVariant(p.variants!, key)
    return Object.entries(filters).every(([attr, selected]) => {
      if (!selected.length) return true
      const index = attrs.findIndex(a => attributeKey(a.attr) === attr)
      return index >= 0 && selected.includes(attributeKey(values[index] ?? ''))
    })
  })
}
// Changing an earlier attribute may choose another available size; later attributes
// respect the earlier selections. This avoids trapping a customer in a sold-out pair.
export function optionVariant(p: VariantProduct, current: string | undefined, index: number, option: string) {
  if (!p.variants) return undefined
  const values = current ? valuesForVariant(p.variants, current) : []
  const candidates = p.variants.options.filter(key => {
    if (!variantAvailable(p, key)) return false
    const parts = valuesForVariant(p.variants!, key)
    return parts[index] === option && parts.slice(0, index).every((value, i) => !values[i] || value === values[i])
  })
  return candidates.find(key => valuesForVariant(p.variants!, key).every((value, i) => i === index || value === values[i])) ?? candidates[0]
}
export function variantImages(p: Pick<PublicProduct, 'variants' | 'images' | 'image'>, key?: string) {
  const detail = key ? p.variants?.details?.[key] : undefined
  const selected = detail?.images?.length ? detail.images : detail?.image ? [detail.image] : []
  return [...new Set([...selected, ...(p.images ?? []), p.image].filter(Boolean))]
}

export function productStockTotal(p: { stock: number; variants?: Variant | null; variantStock?: Record<string, number> | null }) {
  return p.variants?.options.length ? p.variants.options.reduce((sum, key) => sum + (p.variantStock?.[key] ?? 0), 0) : p.stock
}
export function variantStructureChanged(before?: Variant | null, after?: Variant | null) {
  const signature = (v?: Variant | null) => JSON.stringify(attributesOf(v).map(a => [a.attr, [...a.options].sort()]))
  return signature(before) !== signature(after)
}
export function redistributionError(expected: number, assigned: number) {
  return assigned === expected ? '' : assigned < expected
    ? `Quedan ${expected - assigned} unidades por asignar. Distribuí las ${expected} unidades originales antes de guardar.`
    : `Asignaste ${assigned - expected} unidades de más. El total debe conservar las ${expected} unidades originales.`
}
