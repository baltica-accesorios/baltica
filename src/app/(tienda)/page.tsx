import { Home } from '@/storefront/pages/Home'
import { publicProducts } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const products = await publicProducts()
  return <Home newest={products.slice(0, 12)} />
}
