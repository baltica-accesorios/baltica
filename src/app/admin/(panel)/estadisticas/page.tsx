import { requireUser } from '@/lib/auth'
import { salesSince } from '@/lib/data'
import { Stats } from '@/admin/pages/Stats'

export const metadata = { title: 'Estadísticas' }

export default async function Page() {
  await requireUser('duena')
  return <Stats sales={await salesSince(182)} />
}
