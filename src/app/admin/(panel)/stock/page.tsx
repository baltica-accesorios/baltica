import { recentMovements, salesSince } from '@/lib/data'
import { Stock } from '@/admin/pages/Stock'

export const metadata = { title: 'Stock' }

export default async function Page() {
  const [movements, sales] = await Promise.all([recentMovements(200), salesSince(31)])
  return <Stock movements={movements} sales={sales} />
}
