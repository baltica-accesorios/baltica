'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Printer, Search, Plus, Trash2, ChevronUp, ChevronDown, Pencil, Copy, X, AlignCenter, AlignLeft } from 'lucide-react'
import { useAdmin } from '../context'
import { deleteTemplate, uploadImage, upsertTemplate } from '../actions'
import { shrink } from '../components/ImageUpload'
import { PageHeader, Card, Hint, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { LabelView, layoutOf, FIELD_LABEL, ALL_FIELDS } from '../components/LabelView'
import { uid } from '@/lib/format'
import type { LabelField, LabelLayout, LabelTemplate, Product } from '@/lib/types'

export function Labels() {
  const { products, labelTemplates } = useAdmin()
  const sp = useSearchParams()
  const [tpl, setTpl] = useState(labelTemplates[0].id)
  const [queue, setQueue] = useState<{ id: string; n: number }[]>(sp.get('ids') ? sp.get('ids')!.split(',').map(id => ({ id, n: 1 })) : [])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<LabelTemplate | null>(null)
  const t = labelTemplates.find(x => x.id === tpl) ?? labelTemplates[0]
  const results = useMemo(() => q ? products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [], [q, products])
  const add = (id: string, n = 1) => setQueue(qu => qu.some(x => x.id === id) ? qu.map(x => x.id === id ? { ...x, n: x.n + n } : x) : [...qu, { id, n }])
  const items = queue.flatMap(({ id, n }) => { const p = products.find(p => p.id === id); return p ? Array.from({ length: Math.max(0, n) }, () => p) : [] })
  const l = layoutOf(t)
  const newTemplate = () => setEditing({ id: 't' + uid(), name: 'Mi etiqueta', widthMm: 40, heightMm: 25, cols: 3, showPrice: true, showName: true, showSku: false, description: '', layout: { ...layoutOf({ ...t, widthMm: 40, heightMm: 25, layout: null }), order: ['store', 'name', 'barcode', 'price'] } })

  return (
    <>
      <PageHeader title="Etiquetas con código de barras" subtitle="Elegí la plantilla, qué productos y cuántas de cada uno. Las plantillas se diseñan a gusto con el botón Editar.">
        <button className={btnPrimary} disabled={items.length === 0} onClick={() => window.print()}><Printer size={16} /> Imprimir {items.length} etiquetas</button>
      </PageHeader>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card title="1. Plantilla">
            <div className="space-y-2">{labelTemplates.map(x => (
              <div key={x.id} className={`border rounded-lg p-3 cursor-pointer ${tpl === x.id ? 'border-stone-900 bg-stone-50' : ''}`} onClick={() => setTpl(x.id)}>
                <div className="flex items-center gap-2">
                  <input type="radio" readOnly checked={tpl === x.id} />
                  <span className="font-medium text-sm flex-1">{x.name}</span>
                  <button className="text-xs text-stone-500 hover:text-stone-900 inline-flex items-center gap-1" onClick={e => { e.stopPropagation(); setEditing({ ...x, layout: layoutOf(x) }) }}><Pencil size={12} /> Editar</button>
                </div>
                <div className="text-xs text-stone-500 mt-1 ml-5">{x.widthMm}×{x.heightMm} mm · {x.cols} por fila{x.description ? ` · ${x.description}` : ''}</div>
              </div>
            ))}</div>
            <button className={btnGhost + ' mt-3 text-xs'} onClick={newTemplate}><Plus size={14} /> Nueva plantilla</button>
          </Card>
          <Card title="2. Productos">
            <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-stone-400" /><input className={input + ' pl-9'} placeholder="Buscar producto" value={q} onChange={e => setQ(e.target.value)} /></div>
            {results.length > 0 && <ul className="mt-2 divide-y">{results.map(p => <li key={p.id} className="py-1.5 flex items-center gap-2 text-sm cursor-pointer hover:bg-stone-50" onClick={() => { add(p.id); setQ('') }}><img src={p.image} className="w-7 h-7 rounded object-cover" alt="" /><span className="flex-1 truncate">{p.name}</span><Plus size={14} /></li>)}</ul>}
            <div className="flex flex-wrap gap-2 mt-3 text-xs"><button className={btnGhost + ' text-xs'} onClick={() => products.filter(p => p.stock > 0).forEach(p => add(p.id, p.stock))}>Todo el stock (1 por unidad)</button><button className={btnGhost + ' text-xs'} onClick={() => setQueue([])}>Vaciar</button></div>
            <ul className="mt-3 divide-y text-sm">{queue.map(({ id, n }) => { const p = products.find(p => p.id === id); if (!p) return null; return <li key={id} className="py-1.5 flex items-center gap-2"><span className="flex-1 truncate">{p.name}</span><input className="w-14 border rounded px-1 text-right" inputMode="numeric" value={n} onChange={e => setQueue(qu => qu.map(x => x.id === id ? { ...x, n: Number(e.target.value) || 0 } : x))} aria-label="Cantidad de etiquetas" /><button aria-label="Quitar" onClick={() => setQueue(qu => qu.filter(x => x.id !== id))} className="text-stone-400 hover:text-red-600"><Trash2 size={14} /></button></li> })}</ul>
          </Card>
          <Hint><b>Impresoras:</b> para rollos, una térmica tipo Zebra ZD220, Xprinter o Niimbot B1. Para hojas A4 autoadhesivas sirve cualquier impresora común. Al imprimir, elegí <b>márgenes: ninguno</b> y <b>escala 100%</b>.</Hint>
        </div>
        <Card className="lg:col-span-2" title="3. Vista previa (tamaño real)">
          {items.length === 0 ? <div className="text-stone-400 text-center py-20">Agregá productos para ver las etiquetas.</div> : (
            <div className="print-area bg-stone-200 p-4 rounded-lg overflow-auto print:bg-white print:p-0">
              <div className="grid" style={{ gridTemplateColumns: `repeat(${t.cols}, ${t.widthMm}mm)`, gap: `${l.gapMm}mm` }}>
                {items.slice(0, 300).map((p, i) => <LabelView key={i} t={t} p={p} layout={l} />)}
              </div>
              {items.length > 300 && <div className="text-xs text-stone-500 mt-2 print:hidden">Se imprimen de a 300. Mostrando 300 de {items.length}.</div>}
            </div>
          )}
        </Card>
      </div>
      {editing && <LabelEditor initial={editing} sample={products.find(p => p.id === queue[0]?.id) ?? products[0]} products={products} onClose={() => setEditing(null)} onSaved={id => { setTpl(id); setEditing(null) }} canDelete={labelTemplates.length > 1 && labelTemplates.some(x => x.id === editing.id)} />}
    </>
  )
}

function Num({ label, value, onChange, min = 0, max = 100, step = 1, suffix }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <label className="text-xs text-stone-600 block">{label}
      <div className="flex items-center gap-1 mt-0.5">
        <button type="button" className="w-7 h-7 rounded border bg-white" onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))} aria-label={`Menos ${label}`}>−</button>
        <input className="w-full min-w-0 text-center border rounded h-7 text-sm" inputMode="decimal" value={value} onChange={e => { const n = Number(e.target.value.replace(',', '.')); if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n))) }} />
        <button type="button" className="w-7 h-7 rounded border bg-white" onClick={() => onChange(Math.min(max, +(value + step).toFixed(1)))} aria-label={`Más ${label}`}>+</button>
        {suffix && <span className="text-stone-400 w-6">{suffix}</span>}
      </div>
    </label>
  )
}

const SIZE_KEY: Partial<Record<LabelField, keyof LabelLayout>> = { logo: 'logoHeight', store: 'storeSize', name: 'nameSize', price: 'priceSize', sku: 'skuSize', text: 'textSize' }

function LabelEditor({ initial, sample: firstSample, products, onClose, onSaved, canDelete }: { initial: LabelTemplate; sample: Product; products: Product[]; onClose: () => void; onSaved: (id: string) => void; canDelete: boolean }) {
  const [t, setT] = useState<LabelTemplate>(initial)
  const [sample, setSample] = useState(firstSample)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const l = t.layout ?? layoutOf(t)
  const setL = (patch: Partial<LabelLayout>) => setT(x => ({ ...x, layout: { ...l, ...patch } }))
  const move = (f: LabelField, dir: -1 | 1) => { const o = [...l.order]; const i = o.indexOf(f); const j = i + dir; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; setL({ order: o }) }
  const toggle = (f: LabelField) => setL({ order: l.order.includes(f) ? l.order.filter(x => x !== f) : [...l.order, f] })
  // Avisa si el contenido no entra en la etiqueta (habría que achicar letras o barras)
  const previewRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => { const c = previewRef.current?.querySelector('.label-cell') as HTMLElement | null; setOverflow(!!c && (c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1)) }, 150)
    return () => clearTimeout(id)
  })
  // Zoom de la vista previa para que una etiqueta chica se vea grande en pantalla
  const zoom = Math.min(4, Math.max(1, 260 / (t.widthMm * 3.78)))
  const save = async () => {
    setSaving(true); setErr('')
    const r = await upsertTemplate({ ...t, layout: l, showName: l.order.includes('name'), showPrice: l.order.includes('price'), showSku: l.order.includes('sku') })
    setSaving(false)
    if (!r.ok) { setErr(r.error); return }
    onSaved(t.id)
  }
  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-stretch md:items-center justify-center md:p-4" onClick={onClose}>
      <div className="bg-stone-50 md:rounded-2xl w-full max-w-5xl max-h-full overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b px-5 py-3 flex items-center gap-3">
          <h2 className="font-bold flex-1">Diseñar etiqueta</h2>
          <button className={btnGhost} onClick={onClose}><X size={16} /> Cancelar</button>
          <button className={btnPrimary} disabled={saving || !t.name.trim() || !l.order.length} onClick={save}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
        <div className="grid md:grid-cols-5 gap-4 p-4 md:p-5">
          {/* Vista previa: arriba en celular, a la derecha en compu */}
          <div className="md:col-span-2 md:order-2 space-y-3">
            <div className="md:sticky md:top-20 space-y-3">
              <div className="bg-stone-200 rounded-xl p-6 flex items-center justify-center min-h-48 overflow-hidden">
                <div style={{ zoom }} ref={previewRef}><div className="shadow-md"><LabelView t={t} p={sample} layout={l} /></div></div>
              </div>
              {overflow && <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2"><b>No entra todo en la etiqueta.</b> Achicá alguna letra o el alto de las barras, sacá un elemento, o agrandá la etiqueta.</div>}
              <div className="text-xs text-stone-500 text-center">Ampliada ×{zoom.toFixed(1)} · tamaño real {t.widthMm}×{t.heightMm} mm</div>
              <label className="text-xs text-stone-600 block">Probar con otro producto
                <select className={input + ' mt-1 text-sm'} value={sample.id} onChange={e => setSample(products.find(p => p.id === e.target.value) ?? sample)}>{products.slice(0, 400).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </label>
              <div className="bg-white rounded-xl border p-3">
                <div className="text-xs text-stone-500 mb-2">Así queda una fila ({t.cols} por fila)</div>
                <div className="overflow-auto"><div className="grid" style={{ gridTemplateColumns: `repeat(${t.cols}, ${t.widthMm}mm)`, gap: `${l.gapMm}mm`, zoom: Math.min(1, 300 / ((t.widthMm * t.cols + l.gapMm * (t.cols - 1)) * 3.78)) }}>{Array.from({ length: t.cols }, (_, i) => <div key={i} className="outline outline-1 outline-dashed outline-stone-300"><LabelView t={t} p={sample} layout={l} /></div>)}</div></div>
              </div>
            </div>
          </div>

          <div className="md:col-span-3 md:order-1 space-y-4">
            <Card title="Tamaño">
              <label className="text-sm block mb-3">Nombre de la plantilla<input className={input + ' mt-1'} value={t.name} onChange={e => setT({ ...t, name: e.target.value })} /></label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Num label="Ancho" suffix="mm" value={t.widthMm} min={10} max={150} onChange={n => setT({ ...t, widthMm: n })} />
                <Num label="Alto" suffix="mm" value={t.heightMm} min={8} max={150} onChange={n => setT({ ...t, heightMm: n })} />
                <Num label="Por fila" value={t.cols} min={1} max={10} onChange={n => setT({ ...t, cols: Math.round(n) })} />
                <Num label="Separación" suffix="mm" value={l.gapMm} min={0} max={20} step={0.5} onChange={n => setL({ gapMm: n })} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 items-end">
                <Num label="Margen interno" suffix="mm" value={l.paddingMm} min={0} max={10} step={0.5} onChange={n => setL({ paddingMm: n })} />
                <div className="text-xs text-stone-600">Alineación
                  <div className="flex gap-1 mt-0.5">{(['center', 'left'] as const).map(a => <button key={a} type="button" className={`flex-1 h-7 rounded border inline-flex items-center justify-center ${l.align === a ? 'bg-stone-900 text-white' : 'bg-white'}`} onClick={() => setL({ align: a })} aria-label={a === 'center' ? 'Centrado' : 'A la izquierda'}>{a === 'center' ? <AlignCenter size={14} /> : <AlignLeft size={14} />}</button>)}</div>
                </div>
                <label className="text-sm flex items-center gap-2 h-7"><input type="checkbox" checked={l.border} onChange={e => setL({ border: e.target.checked })} /> Borde</label>
              </div>
            </Card>

            <Card title="Qué lleva y en qué orden">
              <p className="text-xs text-stone-500 mb-3">Tildá lo que querés que aparezca. Con las flechas cambiás el orden (de arriba hacia abajo) y con − / + el tamaño de la letra.</p>
              <ul className="space-y-2">
                {[...l.order, ...ALL_FIELDS.filter(f => !l.order.includes(f))].map(f => {
                  const on = l.order.includes(f); const i = l.order.indexOf(f); const sk = SIZE_KEY[f]
                  return (
                    <li key={f} className={`rounded-lg border p-2.5 ${on ? 'bg-white' : 'bg-stone-100 text-stone-400'}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={on} onChange={() => toggle(f)} aria-label={FIELD_LABEL[f]} />
                        <span className="text-sm font-medium flex-1">{FIELD_LABEL[f]}</span>
                        {on && <>
                          <button type="button" className="p-1 rounded hover:bg-stone-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(f, -1)} aria-label="Subir"><ChevronUp size={16} /></button>
                          <button type="button" className="p-1 rounded hover:bg-stone-100 disabled:opacity-30" disabled={i === l.order.length - 1} onClick={() => move(f, 1)} aria-label="Bajar"><ChevronDown size={16} /></button>
                        </>}
                      </div>
                      {on && <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 pl-6">
                        {sk && <Num label={f === 'logo' ? 'Alto' : 'Letra'} suffix={f === 'logo' ? 'mm' : 'pt'} value={(l[sk] as number | undefined) ?? Math.max(3, Math.round(t.heightMm * 0.25))} min={f === 'logo' ? 2 : 3} max={f === 'logo' ? 100 : 40} step={0.5} onChange={n => setL({ [sk]: n } as Partial<LabelLayout>)} />}
                        {f === 'barcode' && <><Num label="Alto de las barras" suffix="mm" value={l.barcodeHeight} min={2} max={60} step={0.5} onChange={n => setL({ barcodeHeight: n })} /><label className="text-sm flex items-center gap-2 self-end h-7"><input type="checkbox" checked={l.barcodeNumber} onChange={e => setL({ barcodeNumber: e.target.checked })} /> Números abajo</label></>}
                        {f === 'price' && <><label className="text-sm flex items-center gap-2 self-end h-7"><input type="checkbox" checked={l.priceBold} onChange={e => setL({ priceBold: e.target.checked })} /> Negrita</label><label className="text-sm flex items-center gap-2 self-end h-7"><input type="checkbox" checked={l.showCents} onChange={e => setL({ showCents: e.target.checked })} /> Con centavos</label></>}
                        {f === 'logo' && <div className="col-span-2 sm:col-span-2 flex flex-wrap items-end gap-2">
                          <label className={btnGhost + ' text-xs py-1.5 cursor-pointer'}><input type="file" accept="image/*" className="hidden" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; const fd = new FormData(); fd.set('file', new File([await shrink(file, 600, 'image/png')], 'logo.png', { type: 'image/png' })); const r = await uploadImage(fd); if (r.ok) setL({ logoUrl: r.url }); else setErr(r.error) }} />Subir otra imagen</label>
                          {l.logoUrl && <button type="button" className="text-xs underline text-stone-500" onClick={() => setL({ logoUrl: '' })}>Usar el logo de Báltica</button>}
                          <label className="text-sm flex items-center gap-2 h-7"><input type="checkbox" checked={!!l.logoBW} onChange={e => setL({ logoBW: e.target.checked })} /> Blanco y negro</label>
                        </div>}
                        {f === 'store' && <label className="text-xs text-stone-600 col-span-2">Texto<input className={input + ' mt-0.5 py-1'} value={l.storeText} onChange={e => setL({ storeText: e.target.value })} /></label>}
                        {f === 'text' && <label className="text-xs text-stone-600 col-span-2">Texto<input className={input + ' mt-0.5 py-1'} value={l.customText} onChange={e => setL({ customText: e.target.value })} placeholder="Ej: Acero quirúrgico · Cambios 30 días" /></label>}
                      </div>}
                    </li>
                  )
                })}
              </ul>
              <p className="text-xs text-stone-500 mt-3">El precio que se imprime es el vigente (si el producto está en oferta, sale el de oferta).</p>
            </Card>

            <Card title="Más">
              <label className="text-sm block">Nota (para acordarte para qué es)<input className={input + ' mt-1'} value={t.description} onChange={e => setT({ ...t, description: e.target.value })} placeholder="Ej: rollo Niimbot para anillos" /></label>
              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" className={btnGhost + ' text-xs'} onClick={() => setT({ ...t, id: 't' + uid(), name: t.name + ' (copia)' })}><Copy size={14} /> Guardar como plantilla nueva</button>
                {canDelete && <button type="button" className={btnGhost + ' text-xs text-red-600'} onClick={async () => { if (!window.confirm(`¿Borrar la plantilla "${initial.name}"?`)) return; const r = await deleteTemplate(initial.id); if (r.ok) onClose(); else setErr(r.error) }}><Trash2 size={14} /> Borrar plantilla</button>}
              </div>
              {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
