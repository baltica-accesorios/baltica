import Link from 'next/link'
import { CATEGORIES, HOME_GRID } from '@/data/categories'
import type { PublicProduct } from '@/lib/types'
import { ProductCard } from '../components/ProductCard'
import { Carousel } from '../components/Carousel'

export function Home({ newest }: { newest: PublicProduct[] }) {
  return (
    <>
      <Carousel />
      <section className="sf-grid">
        {HOME_GRID.map(g => { const c = CATEGORIES.find(c => c.slug === g.slug)!; return (
          <Link key={g.slug} href={`/${g.slug}`} className="sf-tile"><img src={c.image} alt={g.title} loading="lazy" /><h3>{g.title}</h3></Link>
        ) })}
      </section>
      <section className="container">
        <h2 className="sf-section-title"><span>Ingresos</span></h2>
        <div className="sf-feed">{newest.map(p => <ProductCard key={p.id} p={p} />)}</div>
        <div style={{ textAlign: 'center', margin: '60px 0 0' }}><Link href="/productos" className="sf-btn">Ver más</Link></div>
      </section>
    </>
  )
}
