import { requireUser } from '@/lib/auth'
import { Products } from '@/admin/pages/Products'

export const metadata = { title: 'Productos' }

export default async function Page() {
  await requireUser('duena')
  return <Products />
}
