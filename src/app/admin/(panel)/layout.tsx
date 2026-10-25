import { requireUser } from '@/lib/auth'
import { adminBadges, getAnthropicKey, getSettings, listProducts, listTemplates } from '@/lib/data'
import { AdminProvider } from '@/admin/context'
import { AdminLayout } from '@/admin/components/AdminLayout'

export const dynamic = 'force-dynamic'
export const metadata = { title: { default: 'Panel', template: '%s · Panel Báltica' }, robots: { index: false } }

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const settings = await getSettings()
  const [products, labelTemplates, badges, key] = await Promise.all([listProducts(), listTemplates(), adminBadges(settings.lowStockThreshold), getAnthropicKey()])
  // Las vendedoras no ven costos
  const visible = user.role === 'duena' ? products : products.map(p => ({ ...p, cost: 0, markupPct: null }))
  return (
    <AdminProvider value={{ products: visible, settings, labelTemplates, user, badges, hasAnthropicKey: !!key }}>
      <AdminLayout>{children}</AdminLayout>
    </AdminProvider>
  )
}
