'use client'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Printer, Search, Plus, Trash2 } from 'lucide-react'
import { useAdmin } from '../context'
import { upsertTemplate } from '../actions'
import { PageHeader, Card, Hint, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { Barcode } from '../components/Scanner'
import { money, uid } from '@/lib/format'
import type { LabelTemplate } from '@/lib/types'

export function Labels() {
  const { products, labelTemplates } = useAdmin()
  const sp = useSearchParams()
  const [tpl, setTpl] = useState(labelTemplates[0].id)
  const [queue, setQueue] = useState<{ id: string; n: number }[]>(sp.get('ids') ? sp.get('ids')!.split(',').map(id => ({ id, n: 1 })) : [])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<LabelTemplate | null>(null)
  const t = labelTemplates.find(x => x.id === tpl)!
  const results = useMemo(() => q ? products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [], [q, products])
  const add = (id: string, n = 1) => setQueue(qu => qu.some(x => x.id === id) ? qu.map(x => x.id === id ? { ...x, n: x.n + n } : x) : [...qu, { id, n }])
  const items = queue.flatMap(({ id, n }) => { const p = products.find(p => p.id === id); return p ? Array.from({ length: Math.max(0, n) }, () => p) : [] })
  const scale = 3.78 // px por mm aprox a 96dpi
  return (
    <>
      <PageHeader title="Etiquetas con código de barras" subtitle="Elegí qué productos, cuántas etiquetas de cada uno y la plantilla según el rollo o la hoja que tengas. Imprimís desde el navegador.">
        <button className={btnPrimary} disabled={items.length === 0} onClick={() => window.print()}><Printer size={16} /> Imprimir {items.length} etiquetas</button>
      </PageHeader>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card title="1. Plantilla">
            <div className="space-y-2">{labelTemplates.map(x => <label key={x.id} className={`block border rounded-lg p-3 cursor-pointer ${tpl === x.id ? 'border-stone-900 bg-stone-50' : ''}`}><div className="flex items-center gap-2"><input type="radio" checked={tpl === x.id} onChange={() => setTpl(x.id)} /><span className="font-medium text-sm">{x.name}</span><button className="ml-auto text-xs text-stone-400 hover:text-stone-900" onClick={e => { e.preventDefault(); setEditing(x) }}>editar</button></div><div className="text-xs text-stone-500 mt-1 ml-5">{x.widthMm}×{x.heightMm} mm · {x.description}</div></label>)}</div>
            <button className={btnGhost + ' mt-3 text-xs'} onClick={() => setEditing({ id: 't' + uid(), name: 'Nueva plantilla', widthMm: 40, heightMm: 20, cols: 3, showPrice: true, showName: true, showSku: true, description: '' })}><Plus size={14} /> Nueva plantilla</button>
          </Card>
          <Card title="2. Productos">
            <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-stone-400" /><input className={input + ' pl-9'} placeholder="Buscar producto" value={q} onChange={e => setQ(e.target.value)} /></div>
            {results.length > 0 && <ul className="mt-2 divide-y">{results.map(p => <li key={p.id} className="py-1.5 flex items-center gap-2 text-sm cursor-pointer hover:bg-stone-50" onClick={() => { add(p.id); setQ('') }}><img src={p.image} className="w-7 h-7 rounded object-cover" alt="" /><span className="flex-1 truncate">{p.name}</span><Plus size={14} /></li>)}</ul>}
            <div className="flex gap-2 mt-3 text-xs"><button className={btnGhost + ' text-xs'} onClick={() => products.filter(p => p.stock > 0).forEach(p => add(p.id, p.stock))}>Todo el stock (1 por unidad)</button><button className={btnGhost + ' text-xs'} onClick={() => setQueue([])}>Vaciar</button></div>
            <ul className="mt-3 divide-y text-sm">{queue.map(({ id, n }) => { const p = products.find(p => p.id === id); if (!p) return null; return <li key={id} className="py-1.5 flex items-center gap-2"><span className="flex-1 truncate">{p.name}</span><input className="w-14 border rounded px-1 text-right" value={n} onChange={e => setQueue(qu => qu.map(x => x.id === id ? { ...x, n: Number(e.target.value) } : x))} /><button onClick={() => setQueue(qu => qu.filter(x => x.id !== id))} className="text-stone-400 hover:text-red-600"><Trash2 size={14} /></button></li> })}</ul>
          </Card>
          <Hint><b>Impresoras:</b> para rollos, una térmica tipo Zebra ZD220, Xprinter o Niimbot B1 (~$80.000 a $250.000). Para hojas A4 autoadhesivas sirve cualquier impresora común. Nunca hay costo mensual.</Hint>
        </div>
        <Card className="lg:col-span-2" title="3. Vista previa">
          {items.length === 0 ? <div className="text-stone-400 text-center py-20">Agregá productos para ver las etiquetas.</div> : (
            <div className="print-area bg-stone-200 p-4 rounded-lg overflow-auto print:bg-white print:p-0">
              <div className="grid gap-[2mm] print:gap-0" style={{ gridTemplateColumns: `repeat(${t.cols}, ${t.widthMm * scale}px)` }}>
                {items.slice(0, 200).map((p, i) => (
                  <div key={i} className="bg-white overflow-hidden flex flex-col items-center justify-center text-center border border-dashed border-stone-300 print:border-0" style={{ width: t.widthMm * scale, height: t.heightMm * scale, padding: 2 * scale * 0.5 }}>
                    {t.showName && <div className="font-semibold leading-tight truncate w-full" style={{ fontSize: Math.max(6, t.heightMm * 0.32) }}>{p.name.split(' (')[0]}</div>}
                    <Barcode value={p.barcode} height={Math.max(14, t.heightMm * 1.3)} width={t.widthMm < 30 ? 0.9 : 1.2} fontSize={Math.max(7, t.heightMm * 0.4)} displayValue={t.heightMm >= 15} />
                    <div className="flex gap-2 items-baseline">{t.showPrice && <span className="font-bold" style={{ fontSize: Math.max(8, t.heightMm * 0.55) }}>{money(p.price).replace(',00', '')}</span>}{t.showSku && <span className="text-stone-500 font-mono" style={{ fontSize: Math.max(5, t.heightMm * 0.28) }}>{p.sku}</span>}</div>
                  </div>
                ))}
              </div>
              {items.length > 200 && <div className="text-xs text-stone-500 mt-2">Mostrando 200 de {items.length}.</div>}
            </div>
          )}
        </Card>
      </div>
      {editing && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold">Plantilla de etiqueta</h2>
            <label className="text-sm block">Nombre<input className={input + ' mt-1'} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
            <div className="grid grid-cols-3 gap-2"><label className="text-sm">Ancho mm<input className={input + ' mt-1'} type="number" value={editing.widthMm} onChange={e => setEditing({ ...editing, widthMm: Number(e.target.value) })} /></label><label className="text-sm">Alto mm<input className={input + ' mt-1'} type="number" value={editing.heightMm} onChange={e => setEditing({ ...editing, heightMm: Number(e.target.value) })} /></label><label className="text-sm">Columnas<input className={input + ' mt-1'} type="number" value={editing.cols} onChange={e => setEditing({ ...editing, cols: Number(e.target.value) })} /></label></div>
            <div className="flex gap-4 text-sm">{(['showName', 'showPrice', 'showSku'] as const).map(k => <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={editing[k]} onChange={e => setEditing({ ...editing, [k]: e.target.checked })} />{{ showName: 'Nombre', showPrice: 'Precio', showSku: 'SKU' }[k]}</label>)}</div>
            <label className="text-sm block">Descripción<input className={input + ' mt-1'} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></label>
            <div className="flex justify-end gap-2"><button className={btnGhost} onClick={() => setEditing(null)}>Cancelar</button><button className={btnPrimary} onClick={async () => { await upsertTemplate(editing); setTpl(editing.id); setEditing(null) }}>Guardar</button></div>
          </div>
        </div>
      )}
    </>
  )
}
