import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Store, Globe } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { PageHeader, Card, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { money, moneyShort, dateAR, timeAR } from '../../lib/format'
import { saleProfit } from '../../lib/metrics'
import type { Sale } from '../../lib/types'

const STATUS: Record<Sale['status'], string> = { pagada: 'bg-emerald-100 text-emerald-800', pendiente: 'bg-amber-100 text-amber-800', enviada: 'bg-sky-100 text-sky-800', entregada: 'bg-stone-200 text-stone-700', cancelada: 'bg-red-100 text-red-700' }

export function Sales() {
  const { sales, updateSaleStatus } = useStore()
  const [channel, setChannel] = useState<'todas' | 'online' | 'local'>('todas')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Sale | null>(null)
  const list = useMemo(() => [...sales].reverse().filter(s => (channel === 'todas' || s.channel === channel) && (!q || String(s.number).includes(q) || s.customer?.name.toLowerCase().includes(q.toLowerCase()) || s.items.some(i => i.name.toLowerCase().includes(q.toLowerCase())))).slice(0, 200), [sales, channel, q])
  const exportCsv = () => {
    const rows = [['numero', 'fecha', 'canal', 'cliente', 'items', 'subtotal', 'descuento', 'total', 'pago', 'estado', 'ganancia'], ...sales.map(s => [s.number, s.createdAt, s.channel, s.customer?.name ?? '', s.items.map(i => `${i.qty}x ${i.name}`).join(' | '), s.subtotal, s.discount, s.total, s.payment, s.status, saleProfit(s)])]
    const blob = new Blob([rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ventas-baltica.csv'; a.click()
  }
  return (
    <>
      <PageHeader title="Ventas" subtitle="Online y mostrador en un solo lugar. Las ventas online entran como pendientes hasta confirmar el pago.">
        <button className={btnGhost} onClick={exportCsv}><Download size={16} /> Exportar CSV</button>
        <Link to="/admin/pos" className={btnPrimary}>Nueva venta</Link>
      </PageHeader>
      <Card>
        <div className="flex flex-wrap gap-2 mb-4">
          {(['todas', 'online', 'local'] as const).map(c => <button key={c} onClick={() => setChannel(c)} className={`px-3 py-1.5 rounded-full text-sm capitalize ${channel === c ? 'bg-stone-900 text-white' : 'bg-stone-100'}`}>{c === 'local' ? 'Mostrador' : c}</button>)}
          <input className={input + ' max-w-xs ml-auto'} placeholder="Buscar por #, cliente o producto" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2">#</th><th className="pb-2">Fecha</th><th className="pb-2">Canal</th><th className="pb-2">Cliente</th><th className="pb-2">Productos</th><th className="pb-2 text-right">Total</th><th className="pb-2 text-right">Ganancia</th><th className="pb-2">Pago</th><th className="pb-2">Estado</th></tr></thead>
            <tbody className="divide-y">{list.map(s => (
              <tr key={s.id} className="hover:bg-stone-50 cursor-pointer" onClick={() => setOpen(s)}>
                <td className="py-2 font-mono text-xs">{s.number}</td><td className="py-2 whitespace-nowrap">{dateAR(s.createdAt)} <span className="text-stone-400">{timeAR(s.createdAt)}</span></td>
                <td className="py-2">{s.channel === 'local' ? <span className="inline-flex items-center gap-1 text-xs"><Store size={12} /> Mostrador</span> : <span className="inline-flex items-center gap-1 text-xs text-amber-700"><Globe size={12} /> Online</span>}</td>
                <td className="py-2">{s.customer?.name ?? <span className="text-stone-400">—</span>}</td>
                <td className="py-2 max-w-xs truncate">{s.items.map(i => `${i.qty}× ${i.name}`).join(', ')}</td>
                <td className="py-2 text-right font-medium">{moneyShort(s.total)}</td><td className="py-2 text-right text-emerald-700">{moneyShort(saleProfit(s))}</td>
                <td className="py-2 capitalize text-xs">{s.payment}</td><td className="py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${STATUS[s.status]}`}>{s.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end md:items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start"><div><h2 className="text-lg font-bold">Venta #{open.number}</h2><div className="text-sm text-stone-500">{new Date(open.createdAt).toLocaleString('es-AR')} · {open.channel === 'local' ? `Mostrador (${open.seller})` : 'Tienda online'}</div></div><span className={`text-xs px-2 py-1 rounded-full capitalize ${STATUS[open.status]}`}>{open.status}</span></div>
            {open.customer && <div className="mt-3 text-sm">{open.customer.name}{open.customer.email && <span className="text-stone-500"> · {open.customer.email}</span>}{open.customer.city && <span className="text-stone-500"> · {open.customer.city}</span>}</div>}
            <table className="w-full text-sm mt-4"><tbody className="divide-y">{open.items.map((i, k) => <tr key={k}><td className="py-2">{i.qty}× {i.name}{i.variant && <span className="text-stone-500"> ({i.variant})</span>}</td><td className="py-2 text-right">{money(i.qty * i.unitPrice)}</td></tr>)}</tbody></table>
            {open.discount > 0 && <div className="flex justify-between text-sm text-red-600 py-1"><span>Descuento</span><span>-{money(open.discount)}</span></div>}
            <div className="flex justify-between font-bold py-2 border-t"><span>Total ({open.payment})</span><span>{money(open.total)}</span></div>
            <div className="flex justify-between text-xs text-stone-500"><span>Ganancia</span><span>{money(saleProfit(open))}</span></div>
            <div className="flex flex-wrap gap-2 mt-5">
              {(['pagada', 'enviada', 'entregada', 'cancelada'] as Sale['status'][]).filter(s => s !== open.status).map(s => <button key={s} className={btnGhost + ' capitalize text-xs'} onClick={() => { updateSaleStatus(open.id, s); setOpen({ ...open, status: s }) }}>{s === 'cancelada' ? 'Cancelar (devuelve stock)' : `Marcar ${s}`}</button>)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
