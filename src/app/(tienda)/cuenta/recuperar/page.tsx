import { ResetForms } from '@/storefront/pages/Account'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Recuperar contraseña', robots: { index: false } }

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <ResetForms token={(await searchParams).token} />
}
