import { StoreLayout } from '@/storefront/components/Layout'
import { getSettings } from '@/lib/data'
import Script from 'next/script'
import { mpEnabled } from '@/lib/mercadopago'

export const dynamic = 'force-dynamic'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const s = await getSettings()
  return (
    <>
      <StoreLayout contact={{ whatsapp: s.whatsapp, email: s.email, instagram: s.instagram, mpEnabled: mpEnabled(), announcement: s.announcement, categories: s.categories, storeName: s.storeName }}>{children}</StoreLayout>
      {/* Google Analytics: el mismo ID que usaba Empretienda, así las estadísticas siguen sin cortarse */}
      {s.gaId && process.env.NODE_ENV === 'production' && <>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${s.gaId}`} strategy="afterInteractive" />
        <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${s.gaId.replace(/[^A-Z0-9-]/gi, '')}');`}</Script>
      </>}
    </>
  )
}
