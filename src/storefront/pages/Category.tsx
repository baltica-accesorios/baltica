'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { categoryName, subcategoryName } from '@/data/categories'
import type { PublicProduct } from '@/lib/types'
import { ProductCard } from '../components/ProductCard'

export function Category({ products, cat, sub, search, all }: { products: PublicProduct[]; cat?: string; sub?: string; search?: string; all?: boolean }) {
  const [sort, setSort] = useState('new')
  const [opt, setOpt] = useState<string | null>(null)

  const list = useMemo(() => {
    let l = products
    if (opt) l = l.filter(p => p.variants?.options.includes(opt))
    if (sort === 'new') l = [...l].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (sort === 'old') l = [...l].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    if (sort === 'asc') l = [...l].sort((a, b) => (a.offerPrice ?? a.price) - (b.offerPrice ?? b.price))
    if (sort === 'desc') l = [...l].sort((a, b) => (b.offerPrice ?? b.price) - (a.offerPrice ?? a.price))
    return l
  }, [products, sort, opt])

  const attr = useMemo(() => {
    const m = new Map<string, Set<string>>()
    products.forEach(p => { if (p.variants) { if (!m.has(p.variants.attr)) m.set(p.variants.attr, new Set()); p.variants.options.forEach(o => m.get(p.variants!.attr)!.add(o)) } })
    return [...m.entries()][0]
  }, [products])

  return (
    <div className="container">
      <nav className="sf-bc">
        <Link href="/">Inicio</Link>
        {search !== undefined ? <><span className="sep">/</span><span>Resultados para &quot;{search}&quot;</span></> : all ? <><span className="sep">/</span><span>Productos</span></> : <>
          <span className="sep">/</span><Link href={`/${cat}`}>{categoryName(cat!)}</Link>
          {sub && <><span className="sep">/</span><span>{subcategoryName(sub)}</span></>}
        </>}
      </nav>
      <div className="sf-listing">
        <aside className="sf-filter">
          {attr ? <>
            <h4>{attr[0]}</h4>
            <div className="chips">{[...attr[1]].map(o => <button key={o} className={'sf-chip' + (opt === o ? ' on' : '')} onClick={() => setOpt(opt === o ? null : o)}>{o}</button>)}</div>
          </> : null}
        </aside>
        <div>
          <div className="sf-toolbar" style={{ marginBottom: 30, justifyContent: 'flex-end' }}>
            <select className="sf-select" aria-label="Ordenar" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="new">Más nuevo a más viejo</option><option value="old">Más viejo a más nuevo</option>
              <option value="asc">Precio menor a mayor</option><option value="desc">Precio mayor a menor</option>
            </select>
          </div>
          {list.length === 0 ? <p style={{ color: '#666' }}>No encontramos productos.</p> : <div className="sf-feed">{list.map(p => <ProductCard key={p.id} p={p} />)}</div>}
        </div>
      </div>
    </div>
  )
}
