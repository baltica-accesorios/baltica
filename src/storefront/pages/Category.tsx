import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { categoryName, subcategoryName } from '../../data/categories'
import { ProductCard } from '../components/ProductCard'

export function Category({ all = false, search = false }: { all?: boolean; search?: boolean }) {
  const params = useParams(); const cat = params.cat ?? params.page; const sub = params.sub
  const [sp] = useSearchParams()
  const q = sp.get('q')?.toLowerCase() ?? ''
  const products = useStore(s => s.products)
  const [sort, setSort] = useState('new')
  const [opt, setOpt] = useState<string | null>(null)

  const list = useMemo(() => {
    let l = products.filter(p => p.active !== false)
    if (search) l = l.filter(p => p.name.toLowerCase().includes(q))
    else if (!all) l = l.filter(p => p.category === cat && (!sub || p.subcategory === sub))
    if (opt) l = l.filter(p => p.variants?.options.includes(opt))
    if (sort === 'new') l = [...l].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (sort === 'old') l = [...l].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    if (sort === 'asc') l = [...l].sort((a, b) => a.price - b.price)
    if (sort === 'desc') l = [...l].sort((a, b) => b.price - a.price)
    return l
  }, [products, cat, sub, all, search, q, sort, opt])

  const attr = useMemo(() => {
    const m = new Map<string, Set<string>>()
    list.forEach(p => { if (p.variants) { if (!m.has(p.variants.attr)) m.set(p.variants.attr, new Set()); p.variants.options.forEach(o => m.get(p.variants!.attr)!.add(o)) } })
    return [...m.entries()][0]
  }, [list])

  return (
    <div className="container">
      <nav className="sf-bc">
        <Link to="/">Inicio</Link>
        {search ? <><span className="sep">/</span><span>Resultados para "{q}"</span></> : all ? <><span className="sep">/</span><span>Productos</span></> : <>
          <span className="sep">/</span><Link to={`/${cat}`}>{categoryName(cat!)}</Link>
          {sub && <><span className="sep">/</span><span>{subcategoryName(sub)}</span></>}
        </>}
      </nav>
      <div className="sf-listing">
        <aside className="sf-filter">
          {attr ? <>
            <h4>{attr[0]}</h4>
            <div className="chips">{[...attr[1]].map(o => <span key={o} className={'sf-chip' + (opt === o ? ' on' : '')} onClick={() => setOpt(opt === o ? null : o)}>{o}</span>)}</div>
          </> : <h4>Filtrar</h4>}
        </aside>
        <div>
          <div className="sf-toolbar" style={{ marginBottom: 30, justifyContent: 'flex-end' }}>
            <select className="sf-select" value={sort} onChange={e => setSort(e.target.value)}>
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
