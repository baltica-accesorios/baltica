import { requireUser } from '@/lib/auth'
import { Promotions } from '@/admin/pages/Promotions'
export default async function Page() { await requireUser('duena'); return <Promotions /> }
