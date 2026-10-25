import { recentSales } from '@/lib/data'
import { Sales } from '@/admin/pages/Sales'

export const metadata = { title: 'Ventas' }

export default async function Page() {
  return <Sales sales={await recentSales(500)} />
}
