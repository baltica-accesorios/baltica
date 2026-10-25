import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getProduct } from '@/lib/data'
import { ProductForm } from '@/admin/pages/Products'

export const metadata = { title: 'Editar producto' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireUser('duena')
  const p = await getProduct((await params).id)
  if (!p) notFound()
  return <ProductForm key={p.id} existing={p} initialBarcode={p.barcode} />
}
