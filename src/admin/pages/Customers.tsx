'use client'
import { useMemo, useState } from 'react'
import { MessageCircle, Mail, Check, X } from 'lucide-react'
import { PageHeader, Card, Hint, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { setMessageHandled, setWholesale } from '../actions'
import { dateAR, moneyShort, waNumber } from '@/lib/format'
import type { CustomerRow } from '@/lib/data'

interface Message { id: number; kind: string; name: string; email: string; phone: string | null; orderNumber: string | null; body: string; handled: boolean; createdAt: string }

const WS: Record<string, [string, string]> = { pendiente: ['Pidió mayorista', 'bg-amber-100 text-amber-800'], aprobado: ['Mayorista', 'bg-stone-900 text-white'], rechazado: ['Mayorista rechazado', 'bg-stone-200 text-stone-600'] }

export function Customers({ customers, messages, emailOn }: { customers: CustomerRow[]; messages: Message[]; emailOn: boolean }) {
  const pendingWs = customers.filter(c => c.wholesaleStatus === 'pendiente').length
  const openMsgs = messages.filter(m => !m.handled).length
  const [tab, setTab] = useState<'clientes' | 'mayoristas' | 'mensajes'>(pendingWs ? 'mayoristas' : openMsgs ? 'mensajes' : 'clientes')
  const [q, setQ] = useState('')
  const list = useMemo(() => customers.filter(c => (tab !== 'mayoristas' || c.wholesaleStatus !== 'none') && (!q || `${c.name} ${c.email} ${c.phone} ${c.city}`.toLowerCase().includes(q.toLowerCase()))), [customers, tab, q])
  return (
    <>
      <PageHeader title="Clientes" subtitle="Quiénes compran en la tienda online, cuentas mayoristas y mensajes del formulario de contacto." />
      {!emailOn && <div className="mb-4"><Hint>Los emails automáticos (confirmación de pedido, aviso de aprobación mayorista, recuperar contraseña) están apagados hasta configurar el servicio de email (ver guía). Todo lo demás funciona.</Hint></div>}
      <div className="flex gap-2 mb-4 flex-wrap">{([['clientes', `Todos (${customers.length})`], ['mayoristas', `Mayoristas${pendingWs ? ` · ${pendingWs} por aprobar` : ''}`], ['mensajes', `Mensajes${openMsgs ? ` · ${openMsgs} sin responder` : ''}`]] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-full text-sm ${tab === k ? 'bg-stone-900 text-white' : 'bg-white border'}`}>{l}</button>)}</div>

      {tab !== 'mensajes' ? (
        <Card>
          <input className={input + ' mb-3'} placeholder="Buscar por nombre, email, teléfono o ciudad" value={q} onChange={e => setQ(e.target.value)} />
          {list.length === 0 && <p className="text-sm text-stone-400 py-6 text-center">Nada por acá todavía.</p>}
          <ul className="divide-y">{list.map(c => (
            <li key={c.id} className="py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-56">
                <div className="font-medium">{c.name} {WS[c.wholesaleStatus] && <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full ${WS[c.wholesaleStatus][1]}`}>{WS[c.wholesaleStatus][0]}</span>}{c.hasAccount && <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">tiene cuenta</span>}</div>
                <div className="text-xs text-stone-500">{[c.email, c.phone, c.city].filter(Boolean).join(' · ')}</div>
                <div className="text-xs text-stone-500">{c.orders ? `${c.orders} ${c.orders === 1 ? 'compra' : 'compras'} · ${moneyShort(c.spent)}${c.lastOrder ? ` · última ${dateAR(c.lastOrder)}` : ''}` : 'Sin compras online'}{c.source === 'empretienda' ? ' · migrado de Empretienda' : ''}</div>
                {c.wholesaleStatus === 'pendiente' && c.wholesaleNote && <div className="text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">“{c.wholesaleNote}”</div>}
              </div>
              <div className="flex gap-2 flex-wrap">
                {c.phone && <a className={btnGhost + ' text-xs py-1.5'} href={`https://wa.me/${waNumber(c.phone)}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>}
                {c.wholesaleStatus === 'pendiente' && <><button className={btnPrimary + ' text-xs py-1.5'} onClick={() => setWholesale(c.id, 'aprobado')}><Check size={14} /> Aprobar mayorista</button><button className={btnGhost + ' text-xs py-1.5'} onClick={() => setWholesale(c.id, 'rechazado')}><X size={14} /> Rechazar</button></>}
                {c.wholesaleStatus === 'aprobado' && <button className={btnGhost + ' text-xs py-1.5'} onClick={() => { if (window.confirm(`¿Quitarle la cuenta mayorista a ${c.name}?`)) setWholesale(c.id, 'none') }}>Quitar mayorista</button>}
                {(c.wholesaleStatus === 'none' || c.wholesaleStatus === 'rechazado') && tab === 'clientes' && c.email && <button className={btnGhost + ' text-xs py-1.5'} onClick={() => setWholesale(c.id, 'aprobado')}>Hacer mayorista</button>}
              </div>
            </li>
          ))}</ul>
          <p className="text-xs text-stone-500 mt-3">Los mayoristas aprobados ven el &quot;precio mayorista&quot; de cada producto (se carga en la ficha del producto). Si un producto no tiene precio mayorista, ven el normal.</p>
        </Card>
      ) : (
        <Card>
          {messages.length === 0 && <p className="text-sm text-stone-400 py-6 text-center">No hay mensajes.</p>}
          <ul className="divide-y">{messages.map(m => (
            <li key={m.id} className={`py-3 ${m.handled ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm"><span className={`text-[11px] px-2 py-0.5 rounded-full ${m.kind === 'arrepentimiento' ? 'bg-red-100 text-red-700' : 'bg-stone-100'}`}>{m.kind === 'arrepentimiento' ? `Arrepentimiento #${m.id} · pedido ${m.orderNumber}` : 'Contacto'}</span><b>{m.name}</b><span className="text-stone-500 text-xs">{new Date(m.createdAt).toLocaleString('es-AR')}</span></div>
              <p className="text-sm mt-1 whitespace-pre-line">{m.body}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <a className={btnGhost + ' text-xs py-1.5'} href={`mailto:${m.email}?subject=${encodeURIComponent(m.kind === 'arrepentimiento' ? `Tu solicitud de arrepentimiento #${m.id}` : 'Báltica Accesorios')}`}><Mail size={14} /> {m.email}</a>
                {m.phone && <a className={btnGhost + ' text-xs py-1.5'} href={`https://wa.me/${waNumber(m.phone)}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>}
                <button className={btnGhost + ' text-xs py-1.5'} onClick={() => setMessageHandled(m.id, !m.handled)}>{m.handled ? 'Marcar sin responder' : <><Check size={14} /> Respondido</>}</button>
              </div>
            </li>
          ))}</ul>
          <p className="text-xs text-stone-500 mt-3">Los pedidos de arrepentimiento hay que responderlos dentro de las 24 horas (Res. 424/2020).</p>
        </Card>
      )}
    </>
  )
}
