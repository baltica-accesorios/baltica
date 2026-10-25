import { requireUser } from '@/lib/auth'
import { listPurchases } from '@/lib/data'
import { NewPurchase } from '@/admin/pages/Purchases'

export const metadata = { title: 'Nueva compra' }

export default async function Page() {
  await requireUser('duena')
  return <NewPurchase purchases={await listPurchases()} />
}
