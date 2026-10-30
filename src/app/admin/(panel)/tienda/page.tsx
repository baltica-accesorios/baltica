import { requireUser } from '@/lib/auth'
import { StoreEditor } from '@/admin/pages/StoreEditor'
export default async function Page() { await requireUser('duena'); return <StoreEditor /> }
