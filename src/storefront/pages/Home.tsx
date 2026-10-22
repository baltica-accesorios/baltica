import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BANNERS, CATEGORIES, HOME_GRID } from '../../data/categories'
import { useStore } from '../../store/useStore'
import { ProductCard } from '../components/ProductCard'

export function Home() {
  const products = useStore(s => s.products)
  const [slide, setSlide] = useState(0)
  useEffect(() => { const t = setInterval(() => setSlide(s => (s + 1) % BANNERS.length), 3000); return () => clearInterval(t) }, [])
  const newest = [...products].filter(p => p.active !== false).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12)
  return (
    <>
      <section className="sf-carousel">
        <Link to="/grabados"><img src={BANNERS[slide]} alt="Banner" /></Link>
        <div className="sf-dots">{BANNERS.map((_, i) => <span key={i} className={i === slide ? 'on' : ''} onClick={() => setSlide(i)} />)}</div>
      </section>
      <section className="sf-grid">
        {HOME_GRID.map(g => { const c = CATEGORIES.find(c => c.slug === g.slug)!; return (
          <Link key={g.slug} to={`/${g.slug}`} className="sf-tile"><img src={c.image} alt={g.title} loading="lazy" /><h3>{g.title}</h3></Link>
        ) })}
      </section>
      <section className="container">
        <h2 className="sf-section-title"><span>Ingresos</span></h2>
        <div className="sf-feed">{newest.map(p => <ProductCard key={p.id} p={p} />)}</div>
        <div style={{ textAlign: 'center', margin: '60px 0 0' }}><Link to="/productos" className="sf-btn">Ver más</Link></div>
      </section>
    </>
  )
}
