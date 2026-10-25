import { Checkout } from '@/storefront/pages/Checkout'
import { getSettings } from '@/lib/data'
import { mpEnabled } from '@/lib/mercadopago'
import { currentCustomer } from '@/lib/customer-auth'
import { quoteShipping } from '@/lib/shipping'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Finalizar compra', robots: { index: false } }

export default async function Page() {
  const s = await getSettings()
  const me = await currentCustomer()
  return <Checkout me={me ? { name: me.name, email: me.email, phone: me.phone ?? '', city: me.city ?? '' } : null} shipping={await quoteShipping('', 1)} transferPct={s.transferDiscountPct} mpEnabled={mpEnabled()} cashOnPickup={s.cashOnPickup} />
}
