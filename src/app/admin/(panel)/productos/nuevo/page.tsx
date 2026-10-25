import { requireUser } from '@/lib/auth'
import { newBarcode } from '@/admin/actions'
import { ProductForm } from '@/admin/pages/Products'

export const metadata = { title: 'Nuevo producto' }

export default async function Page({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  await requireUser('duena')
  // Desde el escáner: "crear producto con este código"
  const { codigo } = await searchParams
  return <ProductForm initialBarcode={codigo?.trim() || await newBarcode()} />
}
