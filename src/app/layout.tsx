import type { Metadata, Viewport } from 'next'
import { Lato, Inter } from 'next/font/google'
import './globals.css'

const lato = Lato({ subsets: ['latin'], weight: ['300', '400', '700', '900'], variable: '--font-lato' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Báltica Accesorios', template: '%s · Báltica Accesorios' },
  description: 'Accesorios de plata y acero quirúrgico. Envíos a todo el país y showroom en San Nicolás de los Arroyos.',
  icons: { icon: '/favicon.svg' },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#000000' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${lato.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  )
}
