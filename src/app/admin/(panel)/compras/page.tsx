import { requireUser } from '@/lib/auth'
import { listPurchases } from '@/lib/data'
import { Purchases } from '@/admin/pages/Purchases'

export const metadata = { title: 'Compras y facturas' }

export default async function Page() {
  await requireUser('duena')
  return <Purchases purchases={await listPurchases()} />
}
