import { StoreLayout } from '@/storefront/components/Layout'
import { getSettings } from '@/lib/data'
import { mpEnabled } from '@/lib/mercadopago'

export const dynamic = 'force-dynamic'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const s = await getSettings()
  return <StoreLayout contact={{ whatsapp: s.whatsapp, email: s.email, instagram: s.instagram, mpEnabled: mpEnabled() }}>{children}</StoreLayout>
}
