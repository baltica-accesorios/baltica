import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CATEGORIES, categoryName, subcategoryName } from '@/data/categories'
import { getSettings, publicProductBySlug, publicProducts } from '@/lib/data'
import { Category } from '@/storefront/pages/Category'
import { ProductPage } from '@/storefront/pages/Product'
import { INFO, InfoPage } from '@/storefront/pages/Misc'

export const dynamic = 'force-dynamic'

// Las URLs de Empretienda son planas y se respetan tal cual (Google no pierde nada):
//   /talles-anillos             página de información
//   /anillos                    categoría
//   /anillos/anillos-plata      subcategoría
//   /fantasia/choker-marron     producto sin subcategoría
//   /anillos/anillos-plata/x    producto
type Resolved = { kind: 'info'; page: string } | { kind: 'category'; cat: string; sub?: string } | { kind: 'product'; slug: string }

function resolve(slug: string[]): Resolved | null {
  const [a, b, c] = slug
  const cat = CATEGORIES.find(x => x.slug === a)
  if (slug.length === 1) return INFO[a] ? { kind: 'info', page: a } : cat ? { kind: 'category', cat: a } : null
  if (slug.length === 2) return cat?.children?.some(s => s.slug === b) ? { kind: 'category', cat: a, sub: b } : { kind: 'product', slug: b }
  if (slug.length === 3) return { kind: 'product', slug: c }
  return null
}

type Props = { params: Promise<{ slug: string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = resolve((await params).slug)
  if (!r) return {}
  if (r.kind === 'info') return { title: INFO[r.page].title }
  if (r.kind === 'category') return { title: r.sub ? subcategoryName(r.sub) : categoryName(r.cat) }
  const p = await publicProductBySlug(r.slug)
  return p ? { title: p.name, description: p.description ?? `${p.name} en Báltica Accesorios`, openGraph: { images: [p.image] } } : {}
}

export default async function Page({ params }: Props) {
  const r = resolve((await params).slug)
  if (!r) notFound()
  if (r.kind === 'info') return <InfoPage page={r.page} />
  if (r.kind === 'category') return <Category key={r.cat + r.sub} cat={r.cat} sub={r.sub} products={await publicProducts({ category: r.cat, subcategory: r.sub })} />
  const p = await publicProductBySlug(r.slug)
  if (!p) notFound()
  const s = await getSettings()
  return <ProductPage key={p.id} p={p} shipping={s.shippingOptions} />
}
