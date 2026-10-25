import { currentUser } from '@/lib/auth'
import { allSales } from '@/lib/data'
import { saleProfit } from '@/lib/metrics'

export async function GET() {
  const u = await currentUser()
  if (u?.role !== 'duena') return new Response('Sin permiso', { status: 403 })
  const sales = await allSales()
  const rows = [['numero', 'fecha', 'canal', 'cliente', 'email', 'telefono', 'items', 'subtotal', 'descuento', 'envio', 'total', 'pago', 'estado', 'ganancia'],
    ...sales.map(s => [s.number, s.createdAt, s.channel, s.customer?.name ?? '', s.customer?.email ?? '', s.customer?.phone ?? '', s.items.map(i => `${i.qty}x ${i.name}`).join(' | '), s.subtotal, s.discount, s.shipping ?? 0, s.total, s.payment, s.status, saleProfit(s)])]
  // BOM para que Excel abra bien los acentos
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ventas-baltica-${new Date().toISOString().slice(0, 10)}.csv"` } })
}
