import { requireUser } from '@/lib/auth'
import { listCustomers, listMessages } from '@/lib/data'
import { emailEnabled } from '@/lib/email'
import { Customers } from '@/admin/pages/Customers'

export const metadata = { title: 'Clientes' }

export default async function Page() {
  await requireUser('duena')
  const [customers, messages] = await Promise.all([listCustomers(), listMessages()])
  return <Customers customers={customers} messages={messages} emailOn={emailEnabled()} />
}
