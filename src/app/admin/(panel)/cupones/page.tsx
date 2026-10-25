import { requireUser } from '@/lib/auth'
import { listCoupons } from '@/lib/data'
import { Coupons } from '@/admin/pages/Coupons'

export const metadata = { title: 'Cupones' }

export default async function Page() {
  await requireUser('duena')
  return <Coupons coupons={await listCoupons()} />
}
