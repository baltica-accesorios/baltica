import Link from 'next/link'
import type { CSSProperties } from 'react'
import { CATEGORIES, HOME_GRID } from '@/data/categories'
import type { Settings, PublicProduct } from '@/lib/types'
import { ProductFeed } from '../components/ProductFeed'
import { Carousel } from '../components/Carousel'

export function Home({ newest, settings }: { newest: PublicProduct[]; settings: Settings }) {
  return (
    <>
      <Carousel banners={settings.banners} />
      <section className="sf-grid" style={{ '--mobile-category-columns': settings.mobileCategoryColumns ?? 2, '--desktop-category-columns': settings.desktopCategoryColumns ?? 3 } as CSSProperties}>
        {(settings.categories ?? CATEGORIES).filter(c => c.image).map(c => { const g = { slug: c.slug, title: c.tileTitle || c.name }; return (
          <Link key={g.slug} href={c.href || `/${g.slug}`} className="sf-tile"><img src={c.image} alt={g.title} loading="lazy" /><h3>{g.title}</h3></Link>
        ) })}
      </section>
      <section className="container">
        <h2 className="sf-section-title"><span>{settings.homeTitle || 'Ingresos'}</span></h2>
        <ProductFeed products={newest} />
      </section>
    </>
  )
}
