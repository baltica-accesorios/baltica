import { Category } from '@/storefront/pages/Category'
import { publicProducts } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Productos' }

export default async function Page() {
  return <Category all products={await publicProducts()} />
}
