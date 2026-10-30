import { requireUser } from '@/lib/auth'
import { Attributes } from '@/admin/pages/Attributes'
export default async function Page() { await requireUser('duena'); return <Attributes /> }
