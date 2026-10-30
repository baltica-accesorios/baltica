'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, Store, Globe, MessageCircle } from 'lucide-react'
import { editSale, updateFulfillment, updateSaleStatus } from '../actions'
import { useAdmin } from '../context'
import { PageHeader, Card, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { money, moneyShort, dateAR, timeAR, waNumber } from '@/lib/format'
import { saleProfit } from '@/lib/metrics'
import type { Sale } from '@/lib/types'

const STATUS: Record<Sale['status'], string> = { pagada: 'bg-emerald-100 text-emerald-800', pendiente: 'bg-amber-100 text-amber-800', enviada: 'bg-sky-100 text-sky-800', entregada: 'bg-stone-200 text-stone-700', cancelada: 'bg-red-100 text-red-700', a_resolver: 'bg-red-600 text-white' }
const STATUS_LABEL = (s: Sale['status']) => s === 'a_resolver' ? 'a resolver' : s

export function Sales({ sales }: { sales: Sale[] }) {
  const { user, products } = useAdmin()
  const owner = user.role === 'duena'
  const [err, setErr] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lines, setLines] = useState<Sale['items']>([])
  const [channel, setChannel] = useState<'todas' | 'online' | 'local'>('todas')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Sale | null>(null)
  const list = useMemo(() => [...sales].reverse().filter(s => (channel === 'todas' || s.channel === channel) && (!status || (status === 'no_entregadas' ? s.channel === 'online' && !s.delivered && s.status !== 'cancelada' : status === 'empaquetadas' ? s.channel === 'online' && s.packed : status === 'no_abonadas' ? s.channel === 'online' && !s.paid && s.status !== 'cancelada' : s.status === status)) && (!q || String(s.number).includes(q) || s.customer?.name.toLowerCase().includes(q.toLowerCase()) || s.items.some(i => i.name.toLowerCase().includes(q.toLowerCase())))).slice(0, 200), [sales, channel, q, status])
  return (
    <>
      <PageHeader title="Ventas" subtitle="Online y mostrador en un solo lugar. Las ventas online entran como pendientes hasta confirmar el pago.">
        {owner && <a className={btnGhost} href="/admin/ventas/exportar"><Download size={16} /> Exportar todas (CSV)</a>}
        <Link href="/admin/pos" className={btnPrimary}>Nueva venta</Link>
      </PageHeader>
      <Card>
        <div className="flex flex-wrap gap-2 mb-4">
          {(['todas', 'online', 'local'] as const).map(c => <button key={c} onClick={() => setChannel(c)} className={`px-3 py-1.5 rounded-full text-sm capitalize ${channel === c ? 'bg-stone-900 text-white' : 'bg-stone-100'}`}>{c === 'local' ? 'Mostrador' : c}</button>)}
          <select aria-label="Filtrar estado" className={input + " md:w-auto"} value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos los estados</option><option value="no_entregadas">No entregadas</option><option value="no_abonadas">No abonadas</option><option value="empaquetadas">Empaquetadas</option><option value="enviada">Enviadas</option><option value="entregada">Entregadas</option><option value="cancelada">Canceladas</option></select><input className={input + ' md:max-w-xs md:ml-auto'} placeholder="Buscar por #, cliente o producto" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {/* En celular: tarjetas, más fáciles de leer y tocar que una tabla */}
        <ul className="md:hidden divide-y">{list.map(s => (
          <li key={s.id} className="py-3 flex items-start gap-3 cursor-pointer" onClick={() => { setOpen(s); setEditing(false) }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm"><span className="font-mono text-xs text-stone-500">#{s.number}</span>{s.channel === 'local' ? <span className="inline-flex items-center gap-1 text-xs"><Store size={12} /> Mostrador</span> : <span className="inline-flex items-center gap-1 text-xs text-amber-700"><Globe size={12} /> Online</span>}<span className="text-xs text-stone-400">{dateAR(s.createdAt)} {timeAR(s.createdAt)}</span></div>
              <div className="text-sm truncate mt-0.5">{s.customer?.name ? <b className="font-medium">{s.customer.name} · </b> : null}{s.items.map(i => `${i.qty}× ${i.name}`).join(', ')}</div>
            </div>
            <div className="text-right shrink-0"><div className="font-semibold text-sm">{moneyShort(s.total)}</div><span className={`text-[11px] px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${STATUS[s.status]}`}>{STATUS_LABEL(s.status)}</span></div>
          </li>
        ))}</ul>
        <div className="overflow-auto hidden md:block">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2">#</th><th className="pb-2">Fecha</th><th className="pb-2">Canal</th><th className="pb-2">Cliente</th><th className="pb-2">Productos</th><th className="pb-2 text-right">Total</th>{owner && <th className="pb-2 text-right">Ganancia</th>}<th className="pb-2">Pago</th><th className="pb-2">Estado</th></tr></thead>
            <tbody className="divide-y">{list.map(s => (
              <tr key={s.id} className="hover:bg-stone-50 cursor-pointer" onClick={() => { setOpen(s); setEditing(false) }}>
                <td className="py-2 font-mono text-xs">{s.number}</td><td className="py-2 whitespace-nowrap">{dateAR(s.createdAt)} <span className="text-stone-400">{timeAR(s.createdAt)}</span></td>
                <td className="py-2">{s.channel === 'local' ? <span className="inline-flex items-center gap-1 text-xs"><Store size={12} /> Mostrador</span> : <span className="inline-flex items-center gap-1 text-xs text-amber-700"><Globe size={12} /> Online</span>}</td>
                <td className="py-2">{s.customer?.name ?? <span className="text-stone-400">—</span>}</td>
                <td className="py-2 max-w-xs truncate">{s.items.map(i => `${i.qty}× ${i.name}`).join(', ')}</td>
                <td className="py-2 text-right font-medium">{moneyShort(s.total)}</td>{owner && <td className="py-2 text-right text-emerald-700">{moneyShort(saleProfit(s))}</td>}
                <td className="py-2 capitalize text-xs">{s.payment}</td><td className="py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${STATUS[s.status]}`}>{STATUS_LABEL(s.status)}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end md:items-center justify-center p-4" onClick={() => { setOpen(null); setErr('') }}>
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start"><div><h2 className="text-lg font-bold">Venta #{open.number}</h2><div className="text-sm text-stone-500">{new Date(open.createdAt).toLocaleString('es-AR')} · {open.channel === 'local' ? `Mostrador (${open.seller})` : 'Tienda online'}</div></div><span className={`text-xs px-2 py-1 rounded-full capitalize ${STATUS[open.status]}`}>{STATUS_LABEL(open.status)}</span></div>
            {open.customer && <div className="mt-3 text-sm space-y-0.5">
              <div className="font-medium">{open.customer.name}</div>
              <div className="text-stone-500">{[open.customer.email, open.customer.phone].filter(Boolean).join(' · ')}</div>
              {(open.customer.address || open.customer.city) && <div className="text-stone-500">{[open.customer.address, open.customer.city, open.customer.zip].filter(Boolean).join(', ')}</div>}
              {open.customer.phone && <a className="inline-flex items-center gap-1 text-emerald-700 hover:underline" target="_blank" rel="noreferrer" href={`https://wa.me/${waNumber(open.customer.phone)}?text=${encodeURIComponent(`Hola ${open.customer.name.split(' ')[0]}! Te escribimos de Báltica por tu pedido #${open.number}`)}`}><MessageCircle size={14} /> Escribirle por WhatsApp</a>}
            </div>}
            {open.shippingMethod && <div className="mt-2 text-sm"><span className="text-stone-500">Envío:</span> {open.shippingMethod}</div>}
            {open.couponCode && <div className="mt-1 text-sm"><span className="text-stone-500">Cupón:</span> <span className="font-mono">{open.couponCode}</span></div>}
            {open.note && <div className="mt-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{open.note}</div>}
            {open.channel === 'online' && open.status !== 'cancelada' && <div className="flex flex-wrap gap-2 mt-4">{(['paid', 'packed', 'delivered'] as const).map(field => <button key={field} disabled={busy} aria-pressed={!!open[field]} className={'rounded-lg px-3 py-2 text-sm ' + (open[field] ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600')} onClick={async () => { setBusy(true); const r = await updateFulfillment(open.number, field, !open[field]); setBusy(false); if (r.ok) setOpen(r.sale); else setErr(r.error) }}>{open[field] ? '✓ ' : '○ '}{({ paid: 'Abonado', packed: 'Empaquetado', delivered: 'Entregado' })[field]}</button>)}</div>}
            <table className="w-full text-sm mt-4"><tbody className="divide-y">{open.items.map((i, k) => <tr key={k}><td className="py-2 w-16">{products.find(p => p.id === i.productId)?.image && <a href={products.find(p => p.id === i.productId)!.image} target="_blank" rel="noreferrer"><img className="w-12 h-12 object-cover rounded" alt={`Ampliar ${i.name}`} src={products.find(p => p.id === i.productId)!.image} /></a>}</td><td className="py-2">{i.qty}× {i.name}{i.variant && <span className="text-stone-500"> ({i.variant})</span>}<div className="text-xs font-mono text-stone-500">{products.find(p => p.id === i.productId)?.barcode}</div></td><td className="py-2 text-right">{money(i.qty * i.unitPrice)}</td></tr>)}</tbody></table>
            {open.discount > 0 && <div className="flex justify-between text-sm text-red-600 py-1"><span>Descuento</span><span>-{money(open.discount)}</span></div>}
            {(open.shipping ?? 0) > 0 && <div className="flex justify-between text-sm py-1"><span>Envío</span><span>{money(open.shipping!)}</span></div>}
            <div className="flex justify-between font-bold py-2 border-t"><span>Total ({open.payment})</span><span>{money(open.total)}</span></div>
            {owner && <div className="flex justify-between text-xs text-stone-500"><span>Ganancia</span><span>{money(saleProfit(open))}</span></div>}
            {open.payment === 'mercadopago' && <div className="text-xs text-stone-500 mt-1">{open.mpPaymentId ? `Pago de Mercado Pago #${open.mpPaymentId}` : 'Todavía sin pago en Mercado Pago'}</div>}
            {open.status !== 'cancelada' && <button className={btnGhost + ' mt-3'} onClick={() => { setLines(open.items.map(i => ({ ...i }))); setEditing(true) }}>Editar productos de la venta</button>}
            {editing && <div className="mt-3 border rounded-lg p-3 space-y-2"><p className="text-xs text-stone-500">Se conserva el descuento en pesos. Los cambios ajustan stock y total; los cobros o reintegros se gestionan por separado.</p>{lines.map((i, k) => <div key={k} className="flex flex-wrap gap-2 items-center"><span className="flex-1 text-sm">{i.name} {i.variant}</span><input aria-label="Cantidad" type="number" min="1" className={input + ' w-20'} value={i.qty} onChange={e => setLines(lines.map((x, j) => j === k ? { ...x, qty: Number(e.target.value) } : x))} /><input aria-label="Precio unitario" type="number" min="0" className={input + ' w-28'} value={i.unitPrice} onChange={e => setLines(lines.map((x, j) => j === k ? { ...x, unitPrice: Number(e.target.value) } : x))} /><button onClick={() => setLines(lines.filter((_, j) => j !== k))}>Quitar</button></div>)}<select aria-label="Agregar producto a la venta" className={input} value="" onChange={e => { const [id, variant] = JSON.parse(e.target.value); const p = products.find(p => p.id === id)!; setLines([...lines, { productId: id, name: p.name, qty: 1, unitPrice: p.variants?.details?.[variant]?.price ?? p.price, unitCost: p.cost, variant: variant || null }]) }}><option value="">Agregar producto…</option>{products.flatMap(p => (p.variants?.options.length ? p.variants.options : ['']).map(v => <option key={p.id + v} value={JSON.stringify([p.id, v])}>{p.name} {v}</option>))}</select><button disabled={busy} className={btnPrimary} onClick={async () => { setBusy(true); setErr(''); const r = await editSale(open.number, lines, JSON.stringify(open.items.map(i => [i.productId, i.qty, i.unitPrice, i.variant ?? null]))); setBusy(false); if (r.ok) { setOpen(r.sale); setEditing(false) } else setErr(r.error) }}>Guardar venta</button><button className={btnGhost} onClick={() => setEditing(false)}>Cancelar edición</button></div>}
            {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
            <div className="flex flex-wrap gap-2 mt-5">
              {(['pagada', 'enviada', 'entregada', 'cancelada'] as Sale['status'][]).filter(s => s !== open.status).map(s => <button key={s} disabled={busy} className={btnGhost + ' capitalize text-xs'} onClick={async () => { setErr(''); if (s === 'cancelada' && !window.confirm('¿Cancelar la venta? Si descontó stock, se devuelve.')) return; const r = await updateSaleStatus(open.number, s); if (r.ok) setOpen({ ...open, status: s, ...(s === 'pagada' ? { paid: true } : {}), ...(s === 'entregada' ? { delivered: true } : {}), ...(s === 'cancelada' ? { paid: false, packed: false, delivered: false } : {}) }); else setErr(r.error) }}>{s === 'cancelada' ? 'Cancelar (devuelve stock)' : `Marcar ${s}`}</button>)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
