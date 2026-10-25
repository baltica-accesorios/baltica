import { Checkout } from '@/storefront/pages/Checkout'
import { getSettings } from '@/lib/data'
import { mpEnabled } from '@/lib/mercadopago'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Finalizar compra', robots: { index: false } }

export default async function Page() {
  const s = await getSettings()
  return <Checkout shipping={s.shippingOptions} transferPct={s.transferDiscountPct} mpEnabled={mpEnabled()} cashOnPickup={s.cashOnPickup} />
}
