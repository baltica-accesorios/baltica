'use client'
import Link from 'next/link'
import type { PublicProduct } from '@/lib/types'
import { money } from '@/lib/format'
import { offerPct } from '@/lib/pricing'
import { variantImages, variantPrice } from '@/lib/variants'
import { useCart } from '../cart'

export const productPath = (p: Pick<PublicProduct, 'category' | 'subcategory' | 'slug'>) => `/${p.category}${p.subcategory ? '/' + p.subcategory : ''}/${p.slug}`

export function Price({ p }: { p: Pick<PublicProduct, 'price' | 'offerPrice' | 'offerEndsAt'> }) {
  // Igual que Empretienda: precio de oferta primero y el original tachado al lado
  return offerPct(p) ? <>{money(p.offerPrice!)}<del>{money(p.price)}</del></> : <>{money(p.price)}</>
}

export function ProductCard({ p, variant }: { p: PublicProduct; variant?: string }) {
  const add = useCart(s => s.add)
  const href = productPath(p) + (variant ? `?variante=${encodeURIComponent(variant)}` : '')
  const pct = offerPct(p)
  const out = p.stock <= 0
  // Con variantes (talles) hay que elegir en la ficha; sin variantes se agrega directo
  const quick = !out && !p.variants?.options.length
  return (
    <div className={"sf-card" + (out ? " sf-card-out" : "")}>
      <Link href={href} className="img">
        <img src={variant ? variantImages(p, variant)[0] : p.image} alt={p.name} loading="lazy" />
        {p.promotionLabel && !out && <span className="sf-off" style={{ left: 10, right: 'auto' }}>{p.promotionLabel}</span>}
        {pct > 0 && !out && <span className="sf-off">{pct}% OFF</span>}
        {out && <span className="sf-off oos-tag">Sin stock</span>}
      </Link>
      <h3><Link href={href}>{p.name}</Link></h3>
      <p className="price">{out ? <strong>SIN STOCK</strong> : variant ? money(variantPrice(p, variant)) : <Price p={p} />}{p.wholesale && <span className="sf-wholesale-tag">MAYORISTA</span>}</p>
      {quick ? <button className="sf-btn sf-buy" onClick={() => add(p, 1)}>Comprar</button>
        : <Link href={href} className="sf-btn sf-buy">{out ? 'Ver' : 'Comprar'}</Link>}
    </div>
  )
}
