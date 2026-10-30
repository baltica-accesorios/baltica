import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CATEGORIES, categoryName, subcategoryName } from '@/data/categories'
import { getSettings, publicProductBySlug, publicProducts } from '@/lib/data'
import { quoteShipping } from '@/lib/shipping'
import { currentCustomer } from '@/lib/customer-auth'
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

async function resolve(slug: string[]): Promise<Resolved | null> {
  const categories = (await getSettings()).categories ?? CATEGORIES
  const [a, b, c] = slug
  const cat = categories.find(x => x.slug === a)
  const matching = !cat || (b && !cat.children?.some(s => s.slug === b)) ? await publicProducts({ category: a, ...(b ? { subcategory: b } : {}) }) : []
  if (slug.length === 1) return INFO[a] ? { kind: 'info', page: a } : cat || matching.length ? { kind: 'category', cat: a } : null
  if (slug.length === 2) return cat?.children?.some(s => s.slug === b) || matching.length ? { kind: 'category', cat: a, sub: b } : { kind: 'product', slug: b }
  if (slug.length === 3) return { kind: 'product', slug: c }
  return null
}

type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<{ variante?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolve((await params).slug)
  if (!r) return {}
  if (r.kind === 'info') return { title: INFO[r.page].title }
  if (r.kind === 'category') return { title: r.sub ? subcategoryName(r.sub) : categoryName(r.cat) }
  const p = await publicProductBySlug(r.slug)
  return p ? { title: p.name, description: p.description ?? `${p.name} en Báltica Accesorios`, openGraph: { images: [p.image] } } : {}
}

export default async function Page({ params, searchParams }: Props) {
  const r = await resolve((await params).slug)
  if (!r) notFound()
  if (r.kind === 'info') return <InfoPage page={r.page} />
  const category = r.kind === 'category' ? (await getSettings()).categories?.find(c => c.slug === r.cat) : undefined
  if (r.kind === 'category') return <Category title={category?.name} subTitle={category?.children?.find(s => s.slug === r.sub)?.name} key={r.cat + r.sub} cat={r.cat} sub={r.sub} products={await publicProducts({ category: r.cat, subcategory: r.sub }, (await currentCustomer())?.wholesale)} />
  const p = await publicProductBySlug(r.slug, (await currentCustomer())?.wholesale)
  if (!p) notFound()
  return <ProductPage key={p.id + ((await searchParams).variante ?? '')} initialVariant={(await searchParams).variante} p={p} shipping={await quoteShipping('', 1)} />
}
