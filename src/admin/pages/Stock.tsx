'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, PackagePlus, PackageMinus, History, AlertTriangle, ClipboardCheck } from 'lucide-react'
import { useAdmin } from '../context'
import { adjustStock, applyCount } from '../actions'
import { byCode } from '@/lib/search'
import { PageHeader, Card, Hint, Stat, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { useKeyboardWedge, CameraScanner } from '../components/Scanner'
import { moneyShort, dateAR, timeAR } from '@/lib/format'
import { stockValue, coverageDays, reorderQty } from '@/lib/metrics'
import type { MovementReason, Product, Sale, StockMovement } from '@/lib/types'

const REASON: Record<MovementReason, string> = { venta_online: 'Venta online', venta_local: 'Venta mostrador', compra: 'Compra', ajuste: 'Ajuste manual', devolucion: 'Devolución', migracion: 'Migración', rotura: 'Rotura / pérdida' }

export function Stock({ movements, sales }: { movements: StockMovement[]; sales: Sale[] }) {
  const { products, settings, user } = useAdmin()
  const owner = user.role === 'duena'
  const [tab, setTab] = useState<'alertas' | 'todo' | 'movimientos' | 'conteo'>('alertas')
  const [cam, setCam] = useState(false)
  const [picked, setPicked] = useState<Product | null>(null)
  const [count, setCount] = useState<Record<string, number>>({})
  const [flash, setFlash] = useState('')
  const value = stockValue(products)
  const low = products.filter(p => p.stock <= (p.minStock ?? settings.lowStockThreshold)).sort((a, b) => a.stock - b.stock)
  const onScan = useCallback((code: string) => {
    const p = byCode(products, code)
    if (!p) { setFlash(`Código ${code} no encontrado`); return }
    if (tab === 'conteo') { setCount(c => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 })); setFlash(`Contado: ${p.name}`) }
    else setPicked(p)
  }, [products, tab])
  useKeyboardWedge(onScan)
  useEffect(() => { if (flash) { const t = setTimeout(() => setFlash(''), 2500); return () => clearTimeout(t) } }, [flash])
  const recent = useMemo(() => [...movements].filter(m => m.productId !== '*').reverse().slice(0, 100), [movements])
  const diffs = Object.entries(count).map(([id, n]) => ({ p: products.find(p => p.id === id)!, n, diff: n - products.find(p => p.id === id)!.stock }))

  return (
    <>
      <PageHeader title="Stock" subtitle="Un solo stock para la tienda online y el mostrador. Cada movimiento queda registrado: quién, cuándo y por qué.">
        <button className={btnGhost} onClick={() => setCam(true)}><Camera size={16} /> Escanear</button>
      </PageHeader>
      {flash && <div className="fixed top-4 right-4 z-40 bg-stone-900 text-white px-4 py-2 rounded-lg text-sm cursor-pointer" onClick={() => setFlash('')}>{flash}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Unidades en stock" value={String(value.units)} />
        {owner ? <Stat label="Valor a costo" value={moneyShort(value.cost)} sub="plata invertida en mercadería" /> : <Stat label="Productos" value={String(products.length)} />}
        <Stat label="Valor a precio de venta" value={moneyShort(value.retail)} sub={owner ? `ganancia potencial ${moneyShort(value.retail - value.cost)}` : undefined} tone="good" />
        <Stat label="Alertas" value={String(low.length)} sub={`${low.filter(p => p.stock === 0).length} sin stock`} tone={low.length ? 'warn' : 'good'} />
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">{([['alertas', 'Alertas'], ['todo', 'Todo el stock'], ['movimientos', 'Movimientos'], ['conteo', 'Conteo / inventario']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-full text-sm ${tab === k ? 'bg-stone-900 text-white' : 'bg-white border'}`}>{l}</button>)}</div>

      {tab === 'alertas' && <Card>
        <div className="overflow-auto"><table className="w-full text-sm min-w-[560px]"><thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2">Producto</th><th className="pb-2 text-right">Stock</th><th className="pb-2 text-right">Mínimo</th><th className="pb-2 text-right">Cobertura</th><th className="pb-2 text-right">Reponer</th><th /></tr></thead>
          <tbody className="divide-y">{low.map(p => { const d = coverageDays(p, sales); return (
            <tr key={p.id}><td className="py-2"><div className="flex items-center gap-3"><img src={p.image} className="w-9 h-9 rounded object-cover" alt="" /><div>{p.name}<div className="text-xs text-stone-400 font-mono">{p.sku}</div></div></div></td>
              <td className="py-2 text-right"><span className={`px-2 py-0.5 rounded-full text-xs ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{p.stock}</span></td><td className="py-2 text-right text-stone-500">{p.minStock ?? settings.lowStockThreshold}</td>
              <td className="py-2 text-right text-xs">{d === Infinity ? <span className="text-stone-400">sin ventas 30d</span> : p.stock === 0 ? <span className="text-red-600 font-medium">agotado, se vende</span> : `${Math.ceil(d)} días`}</td>
              <td className="py-2 text-right text-xs">{d === Infinity ? '—' : <b>{reorderQty(p, sales)} u.</b>}{d !== Infinity && <span className="text-stone-400"> para 30 días</span>}</td>
              <td className="py-2 text-right"><button className={btnGhost + ' text-xs py-1'} onClick={() => setPicked(p)}><PackagePlus size={14} /> Ajustar</button></td></tr>) })}</tbody></table></div>
        {low.length === 0 && <p className="text-sm text-stone-500">Sin alertas.</p>}
      </Card>}

      {tab === 'todo' && <Card><div className="overflow-auto"><table className="w-full text-sm"><thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2">Producto</th><th className="pb-2">Código</th><th className="pb-2 text-right">Stock</th>{owner && <th className="pb-2 text-right">A costo</th>}<th className="pb-2 text-right">A venta</th><th /></tr></thead>
        <tbody className="divide-y">{[...products].sort((a, b) => a.name.localeCompare(b.name)).map(p => <tr key={p.id} className="hover:bg-stone-50"><td className="py-1.5"><div className="flex items-center gap-2"><img src={p.image} className="w-8 h-8 rounded object-cover" alt="" />{p.name}</div></td><td className="font-mono text-xs text-stone-500">{p.barcode}</td><td className="text-right font-medium">{p.stock}</td>{owner && <td className="text-right text-stone-500">{moneyShort(p.stock * p.cost)}</td>}<td className="text-right">{moneyShort(p.stock * p.price)}</td><td className="text-right"><button className="text-xs text-stone-500 hover:text-stone-900" onClick={() => setPicked(p)}>ajustar</button></td></tr>)}</tbody></table></div></Card>}

      {tab === 'movimientos' && <Card><div className="overflow-auto"><table className="w-full text-sm min-w-[560px]"><thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2">Fecha</th><th className="pb-2">Producto</th><th className="pb-2">Motivo</th><th className="pb-2 text-right">Cantidad</th><th className="pb-2">Quién</th></tr></thead>
        <tbody className="divide-y">{recent.map(m => { const p = products.find(p => p.id === m.productId); return <tr key={m.id}><td className="py-1.5 whitespace-nowrap text-stone-500">{dateAR(m.createdAt)} {timeAR(m.createdAt)}</td><td className="py-1.5">{p?.name ?? m.productId}</td><td className="py-1.5 text-xs"><span className="px-2 py-0.5 rounded-full bg-stone-100">{REASON[m.reason]}</span>{m.ref && <span className="text-stone-400 ml-1">{/^s\d+$/.test(m.ref) ? '#' + m.ref.slice(1) : m.ref}</span>}</td><td className={`py-1.5 text-right font-medium ${m.delta < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{m.delta > 0 ? '+' : ''}{m.delta}</td><td className="py-1.5 text-stone-500">{m.by}</td></tr> })}</tbody></table></div></Card>}

      {tab === 'conteo' && <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="Conteo físico">
          <Hint>Escaneá cada pieza del local (o del cajón que estés contando). Al final te mostramos las diferencias contra el sistema y las aplicás con un click.</Hint>
          <table className="w-full text-sm mt-3"><thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2">Producto</th><th className="pb-2 text-right">Sistema</th><th className="pb-2 text-right">Contado</th><th className="pb-2 text-right">Diferencia</th></tr></thead>
            <tbody className="divide-y">{diffs.map(d => <tr key={d.p.id}><td className="py-1.5">{d.p.name}</td><td className="text-right text-stone-500">{d.p.stock}</td><td className="text-right"><input className="w-16 text-right border rounded px-1" value={d.n} onChange={e => setCount(c => ({ ...c, [d.p.id]: Number(e.target.value) }))} /></td><td className={`text-right font-medium ${d.diff === 0 ? 'text-stone-400' : d.diff < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{d.diff > 0 ? '+' : ''}{d.diff}</td></tr>)}</tbody></table>
          {diffs.length === 0 && <p className="text-sm text-stone-400 py-6 text-center">Todavía no escaneaste nada. Probá con el botón de cámara o escribí un código abajo.</p>}
          <div className="flex gap-2 mt-4"><input className={input + ' max-w-xs font-mono'} placeholder="o pegá un código y Enter" onKeyDown={e => { if (e.key === 'Enter') { onScan((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = '' } }} /><button className={btnPrimary} disabled={!diffs.some(d => d.diff !== 0)} onClick={async () => { await applyCount(diffs.map(d => ({ productId: d.p.id, counted: d.n }))); setCount({}); setFlash('Diferencias aplicadas') }}><ClipboardCheck size={16} /> Aplicar diferencias</button></div>
        </Card>
        <Card title="¿Por qué sirve?"><ul className="text-sm space-y-2 text-stone-600 list-disc pl-4"><li>Detecta roturas y pérdidas que nadie cargó.</li><li>Evita vender online algo que ya no está.</li><li>Lleva 5 minutos por vitrina con el celular.</li></ul></Card>
      </div>}

      {picked && <AdjustModal p={picked} onClose={() => setPicked(null)} onApply={async (delta, reason) => { const r = await adjustStock(picked.id, delta, reason); setPicked(null); setFlash(r.ok ? 'Stock actualizado' : r.error) }} />}
      {cam && <CameraScanner onScan={onScan} onClose={() => setCam(false)} />}
    </>
  )
}

function AdjustModal({ p, onClose, onApply }: { p: Product; onClose: () => void; onApply: (delta: number, reason: MovementReason) => void }) {
  const [n, setN] = useState(1); const [reason, setReason] = useState<MovementReason>('compra')
  const sign = reason === 'rotura' || reason === 'venta_local' ? -1 : reason === 'ajuste' ? 1 : 1
  const [dir, setDir] = useState<1 | -1>(sign as 1 | -1)
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3"><img src={p.image} className="w-12 h-12 rounded object-cover" alt="" /><div><div className="font-semibold">{p.name}</div><div className="text-sm text-stone-500">Stock actual: <b>{p.stock}</b></div></div></div>
        <div className="grid grid-cols-2 gap-2 mt-4"><button onClick={() => { setDir(1); setReason('compra') }} className={`rounded-lg border p-3 flex items-center gap-2 text-sm ${dir === 1 ? 'bg-stone-900 text-white' : ''}`}><PackagePlus size={16} /> Ingresó mercadería</button><button onClick={() => { setDir(-1); setReason('rotura') }} className={`rounded-lg border p-3 flex items-center gap-2 text-sm ${dir === -1 ? 'bg-stone-900 text-white' : ''}`}><PackageMinus size={16} /> Salió / se rompió</button></div>
        <div className="grid grid-cols-2 gap-3 mt-3"><label className="text-sm">Cantidad<input className={input + ' mt-1'} type="number" min={1} value={n} onChange={e => setN(Number(e.target.value))} /></label><label className="text-sm">Motivo<select className={input + ' mt-1'} value={reason} onChange={e => setReason(e.target.value as MovementReason)}>{(dir === 1 ? ['compra', 'devolucion', 'ajuste'] : ['rotura', 'ajuste']).map(r => <option key={r} value={r}>{REASON[r as MovementReason]}</option>)}</select></label></div>
        <div className="text-sm text-stone-500 mt-3 flex items-center gap-2"><History size={14} /> Nuevo stock: <b>{Math.max(0, p.stock + dir * n)}</b></div>
        {dir === -1 && n > p.stock && <div className="text-xs text-amber-700 mt-2 flex gap-1"><AlertTriangle size={14} /> No podés sacar más de lo que hay.</div>}
        <div className="flex gap-2 mt-5 justify-end"><button className={btnGhost} onClick={onClose}>Cancelar</button><button className={btnPrimary} disabled={dir === -1 && n > p.stock} onClick={() => onApply(dir * n, reason)}>Aplicar</button></div>
      </div>
    </div>
  )
}
