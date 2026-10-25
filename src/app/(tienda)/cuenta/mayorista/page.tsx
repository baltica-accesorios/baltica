import { currentCustomer } from '@/lib/customer-auth'
import { WholesaleForm } from '@/storefront/pages/Account'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Cuenta mayorista' }

export default async function Page() {
  const me = await currentCustomer()
  return <WholesaleForm loggedIn={!!me} status={me?.wholesaleStatus} />
}
