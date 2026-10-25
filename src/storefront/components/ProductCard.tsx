'use client'
import Link from 'next/link'
import type { PublicProduct } from '@/lib/types'
import { money } from '@/lib/format'
import { offerPct } from '@/lib/pricing'
import { useCart } from '../cart'

export const productPath = (p: Pick<PublicProduct, 'category' | 'subcategory' | 'slug'>) => `/${p.category}${p.subcategory ? '/' + p.subcategory : ''}/${p.slug}`

export function Price({ p }: { p: Pick<PublicProduct, 'price' | 'offerPrice' | 'offerEndsAt'> }) {
  // Igual que Empretienda: precio de oferta primero y el original tachado al lado
  return offerPct(p) ? <>{money(p.offerPrice!)}<del>{money(p.price)}</del></> : <>{money(p.price)}</>
}

export function ProductCard({ p }: { p: PublicProduct }) {
  const add = useCart(s => s.add)
  const pct = offerPct(p)
  const out = p.stock <= 0
  // Con variantes (talles) hay que elegir en la ficha; sin variantes se agrega directo
  const quick = !out && !p.variants?.options.length
  return (
    <div className="sf-card">
      <Link href={productPath(p)} className="img">
        <img src={p.image} alt={p.name} loading="lazy" />
        {pct > 0 && !out && <span className="sf-off">{pct}% OFF</span>}
        {out && <span className="sf-off oos-tag">SIN STOCK</span>}
      </Link>
      <h3><Link href={productPath(p)}>{p.name}</Link></h3>
      <p className="price"><Price p={p} /></p>
      {quick ? <button className="sf-btn sf-buy" onClick={() => add(p, 1)}>Comprar</button>
        : <Link href={productPath(p)} className="sf-btn sf-buy">{out ? 'Ver' : 'Comprar'}</Link>}
    </div>
  )
}
