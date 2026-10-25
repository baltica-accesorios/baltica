'use client'
import { useState } from 'react'
import { Plus, Trash2, Ticket } from 'lucide-react'
import { PageHeader, Card, Hint, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { deleteCoupon, saveCoupon } from '../actions'
import { money } from '@/lib/format'
import type { Coupon } from '@/lib/types'

const toLocalInput = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
const describe = (c: Coupon) => c.type === 'pct' ? `${c.value}% OFF` : c.type === 'fixed' ? `${money(c.value)} de descuento` : 'Envío gratis'
const empty = { code: '', type: 'pct' as Coupon['type'], value: 10, minAmount: 0, endsAt: null as string | null, maxUses: null as number | null, active: true }

export function Coupons({ coupons }: { coupons: Coupon[] }) {
  const [form, setForm] = useState<typeof empty | null>(null)
  const [isNew, setIsNew] = useState(true)
  const [err, setErr] = useState('')
  const save = async () => { setErr(''); const r = await saveCoupon(form!, isNew); if (r.ok) setForm(null); else setErr(r.error) }
  const status = (c: Coupon) => !c.active ? ['Pausado', 'bg-stone-200 text-stone-600'] : c.endsAt && new Date(c.endsAt) <= new Date() ? ['Vencido', 'bg-red-100 text-red-700'] : c.maxUses != null && c.uses >= c.maxUses ? ['Agotado', 'bg-amber-100 text-amber-800'] : ['Activo', 'bg-emerald-100 text-emerald-800']
  return (
    <>
      <PageHeader title="Cupones de descuento" subtitle="Códigos que los clientes escriben al finalizar la compra en la tienda online.">
        <button className={btnPrimary} onClick={() => { setForm({ ...empty }); setIsNew(true); setErr('') }}><Plus size={16} /> Nuevo cupón</button>
      </PageHeader>
      <Card>
        {coupons.length === 0 ? <div className="text-center py-10 text-stone-400"><Ticket size={36} className="mx-auto mb-2 text-stone-300" />Todavía no hay cupones.<div className="text-xs mt-1">Ej: BIENVENIDA10 para 10% en la primera compra.</div></div> : (
          <ul className="divide-y">{coupons.map(c => { const [label, cls] = status(c); return (
            <li key={c.code} className="py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-48">
                <div className="font-mono font-semibold">{c.code} <span className={`ml-1 font-sans text-[11px] px-2 py-0.5 rounded-full ${cls}`}>{label}</span></div>
                <div className="text-sm text-stone-600">{describe(c)}{c.minAmount ? ` · compras desde ${money(c.minAmount)}` : ''}</div>
                <div className="text-xs text-stone-500">Usado {c.uses}{c.maxUses != null ? ` de ${c.maxUses}` : ''} {c.uses === 1 ? 'vez' : 'veces'}{c.endsAt ? ` · vence ${new Date(c.endsAt).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}</div>
              </div>
              <button className={btnGhost + ' text-xs py-1.5'} onClick={() => { setForm({ ...c }); setIsNew(false); setErr('') }}>Editar</button>
              <button className={btnGhost + ' text-xs py-1.5'} onClick={() => saveCoupon({ ...c, active: !c.active }, false)}>{c.active ? 'Pausar' : 'Activar'}</button>
              <button className="text-stone-400 hover:text-red-600" aria-label="Borrar" onClick={() => { if (window.confirm(`¿Borrar el cupón ${c.code}?`)) deleteCoupon(c.code) }}><Trash2 size={16} /></button>
            </li>) })}</ul>
        )}
      </Card>
      <div className="mt-4"><Hint>El cupón se suma al descuento por transferencia si lo hay. Las ventas que lo usaron muestran el código en Ventas.</Hint></div>
      {form && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end md:items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold">{isNew ? 'Nuevo cupón' : `Editar ${form.code}`}</h2>
            {isNew && <label className="text-sm block">Código<input className={input + ' mt-1 font-mono uppercase'} value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="BIENVENIDA10" autoFocus /></label>}
            <div className="grid grid-cols-3 gap-2">{([['pct', '% de descuento'], ['fixed', '$ de descuento'], ['envio', 'Envío gratis']] as const).map(([t, l]) => <button key={t} type="button" className={`rounded-lg border p-2 text-xs ${form.type === t ? 'bg-stone-900 text-white' : ''}`} onClick={() => setForm({ ...form, type: t })}>{l}</button>)}</div>
            {form.type !== 'envio' && <label className="text-sm block">{form.type === 'pct' ? 'Porcentaje' : 'Monto en pesos'}<input className={input + ' mt-1'} type="number" value={form.value} onChange={e => setForm({ ...form, value: Number(e.target.value) })} /></label>}
            <label className="text-sm block">Compra mínima (0 = sin mínimo)<input className={input + ' mt-1'} type="number" value={form.minAmount} onChange={e => setForm({ ...form, minAmount: Number(e.target.value) })} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm block">Vence (opcional)<input className={input + ' mt-1'} type="datetime-local" value={form.endsAt ? toLocalInput(form.endsAt) : ''} onChange={e => setForm({ ...form, endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
              <label className="text-sm block">Usos máximos (opcional)<input className={input + ' mt-1'} type="number" value={form.maxUses ?? ''} onChange={e => setForm({ ...form, maxUses: e.target.value ? Number(e.target.value) : null })} placeholder="sin límite" /></label>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex justify-end gap-2"><button className={btnGhost} onClick={() => setForm(null)}>Cancelar</button><button className={btnPrimary} onClick={save}>Guardar</button></div>
          </div>
        </div>
      )}
    </>
  )
}
