import { requireUser } from '@/lib/auth'
import { salesSince } from '@/lib/data'
import { Dashboard } from '@/admin/pages/Dashboard'

export default async function Page() {
  await requireUser('duena')
  return <Dashboard sales={await salesSince(62)} />
}
