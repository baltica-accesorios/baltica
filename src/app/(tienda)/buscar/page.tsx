import { currentCustomer } from '@/lib/customer-auth'
import { Category } from '@/storefront/pages/Category'
import { publicProducts } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Buscar', robots: { index: false } }

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim().slice(0, 80)
  return <Category key={q} search={q} products={q ? await publicProducts({ search: q }, (await currentCustomer())?.wholesale) : []} />
}
