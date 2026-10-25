import { migrationStatus } from '@/admin/migration-actions'
import { Migration } from '@/admin/pages/Migration'

export const metadata = { title: 'Migrar Empretienda' }

export default async function Page() {
  return <Migration status={await migrationStatus()} />
}
