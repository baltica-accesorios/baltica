import { requireUser } from '@/lib/auth'
import { listUsers } from '@/admin/actions'
import { SettingsPage } from '@/admin/pages/Settings'

export const metadata = { title: 'Configuración' }

export default async function Page() {
  await requireUser('duena')
  const token = process.env.MP_ACCESS_TOKEN ?? ''
  return <SettingsPage users={await listUsers()} mp={{ enabled: !!token, test: token.startsWith('TEST-'), webhook: !!process.env.MP_WEBHOOK_SECRET }} />
}
