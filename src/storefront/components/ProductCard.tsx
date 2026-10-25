import Link from 'next/link'
import type { PublicProduct } from '@/lib/types'
import { money } from '@/lib/format'

export const productPath = (p: Pick<PublicProduct, 'category' | 'subcategory' | 'slug'>) => `/${p.category}${p.subcategory ? '/' + p.subcategory : ''}/${p.slug}`

export function ProductCard({ p }: { p: PublicProduct }) {
  return (
    <div className="sf-card">
      <Link href={productPath(p)}><img src={p.image} alt={p.name} loading="lazy" /></Link>
      <h3><Link href={productPath(p)}>{p.name}</Link></h3>
      <p className="price">{p.offerPrice ? <><del>{money(p.price)}</del>{money(p.offerPrice)}</> : money(p.price)}</p>
      {p.stock <= 0 && <div className="oos">Sin stock</div>}
    </div>
  )
}
