'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { categoryName, subcategoryName } from '@/data/categories'
import type { PublicProduct } from '@/lib/types'
import { ProductFeed } from '../components/ProductFeed'
import { attributeKey, attributesOf, matchingVariants, variantPrice, type AttributeFilters } from '@/lib/variants'

export function Category({ products, cat, sub, search, all, title, subTitle }: { products: PublicProduct[]; cat?: string; sub?: string; search?: string; all?: boolean; title?: string; subTitle?: string }) {
  const [sort, setSort] = useState('new')
  const [filters, setFilters] = useState<AttributeFilters>({})
  const active = Object.values(filters).some(v => v.length)
  const selectedVariants = useMemo(() => Object.fromEntries(products.flatMap(p => {
    const match = active ? matchingVariants(p, filters)[0] : undefined
    return match ? [[p.id, match]] : []
  })), [products, filters, active])

  const list = useMemo(() => {
    let l = products
    if (active) l = l.filter(p => selectedVariants[p.id])
    if (sort === 'new') l = [...l].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (sort === 'old') l = [...l].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    if (sort === 'asc') l = [...l].sort((a, b) => variantPrice(a, selectedVariants[a.id]) - variantPrice(b, selectedVariants[b.id]))
    if (sort === 'desc') l = [...l].sort((a, b) => variantPrice(b, selectedVariants[b.id]) - variantPrice(a, selectedVariants[a.id]))
    return l
  }, [products, sort, active, selectedVariants])

  const facets = useMemo(() => {
    const groups = new Map<string, { name: string; values: Map<string, { label: string; color?: string }> }>()
    products.forEach(p => attributesOf(p.variants).forEach(a => {
      const key = attributeKey(a.attr)
      if (!groups.has(key)) groups.set(key, { name: a.attr, values: new Map() })
      a.options.forEach(label => groups.get(key)!.values.set(attributeKey(label), { label, color: a.type === 'color' ? a.colors?.[label] : undefined }))
    }))
    return [...groups.entries()]
  }, [products])

  return (
    <div className="container">
      <nav className="sf-bc">
        <Link href="/">Inicio</Link>
        {search !== undefined ? <><span className="sep">/</span><span>Resultados para &quot;{search}&quot;</span></> : all ? <><span className="sep">/</span><span>Productos</span></> : <>
          <span className="sep">/</span><Link href={`/${cat}`}>{title || categoryName(cat!)}</Link>
          {sub && <><span className="sep">/</span><span>{subTitle || subcategoryName(sub)}</span></>}
        </>}
      </nav>
      <div className="sf-listing">
        <aside className="sf-filter">
          {active && <button className="sf-clear-filters" onClick={() => setFilters({})}>Limpiar filtros</button>}
          {facets.map(([key, group]) => <section className="sf-facet" key={key}>
            <h4>{group.name}</h4><div className="chips">{[...group.values].map(([value, option]) => {
              const selected = filters[key]?.includes(value) ?? false
              const count = products.filter(p => matchingVariants(p, { ...filters, [key]: [value] }).length).length
              return <button key={value} aria-pressed={selected} disabled={!selected && !count} title={!count ? `${option.label}: sin stock` : option.label} className={'sf-chip sf-facet-option' + (selected ? ' on' : '')} onClick={() => setFilters(f => ({ ...f, [key]: selected ? (f[key] ?? []).filter(v => v !== value) : [...(f[key] ?? []), value] }))}>
                {option.color && <span className="sf-swatch" style={{ backgroundColor: option.color }} />}{option.label}<small>{count}</small>
              </button>
            })}</div>
          </section>)}
        </aside>
        <div>
          <div className="sf-toolbar" style={{ marginBottom: 30, justifyContent: 'flex-end' }}>
            <select className="sf-select" aria-label="Ordenar" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="new">Más nuevo a más viejo</option><option value="old">Más viejo a más nuevo</option>
              <option value="asc">Precio menor a mayor</option><option value="desc">Precio mayor a menor</option>
            </select>
          </div>
          {list.length === 0 ? <p style={{ color: '#666' }}>No encontramos productos.</p> : <ProductFeed products={list} selectedVariants={selectedVariants} />}
        </div>
      </div>
    </div>
  )
}
