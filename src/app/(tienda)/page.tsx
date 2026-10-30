import { currentCustomer } from '@/lib/customer-auth'
import { Home } from '@/storefront/pages/Home'
import { getSettings, publicProducts } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const products = await publicProducts({}, (await currentCustomer())?.wholesale)
  return <Home newest={products} settings={await getSettings()} />
}
