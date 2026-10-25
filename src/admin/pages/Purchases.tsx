'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Camera, Upload, Sparkles, Check, Link2, Plus, ArrowLeft, Brain, RotateCcw, History } from 'lucide-react'
import { useAdmin } from '../context'
import { confirmPurchase, readInvoicePhoto } from '../actions'
import { PageHeader, Card, Hint, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { money, moneyShort, dateAR, roundTo } from '@/lib/format'
import type { Product, Purchase, PurchaseLine } from '@/lib/types'

export function Purchases({ purchases }: { purchases: Purchase[] }) {
  const { settings, hasAnthropicKey } = useAdmin()
  const ai = settings.aiInvoices && hasAnthropicKey
  return (
    <>
      <PageHeader title="Compras y facturas" subtitle="Cargá lo que compraste a los proveedores: suma stock, actualiza el costo y calcula el precio final con el % de ganancia de cada producto. Con la lectura por foto (opcional) lo hace solo a partir de la factura.">
        <Link href="/admin/compras/nueva" className={ai ? btnGhost : btnPrimary}><Upload size={16} /> Cargar compra</Link>
        {ai && <Link href="/admin/compras/nueva" className={btnPrimary}><Camera size={16} /> Cargar factura por foto</Link>}
      </PageHeader>
      {!ai && <div className="mb-4"><Hint><b>La lectura de facturas por foto está apagada.</b> Usa la cuenta de Claude (Anthropic) de Báltica y se paga por uso, unos centavos por factura, sin abono. Se activa en <Link href="/admin/configuracion" className="underline">Configuración</Link> cargando la clave. Mientras tanto, las compras se cargan a mano con el mismo formulario.</Hint></div>}
      <Card>
        <ul className="md:hidden divide-y">
          {purchases.length === 0 && <li className="py-6 text-center text-stone-400 text-sm">Todavía no cargaste compras.</li>}
          {purchases.map(p => (
            <li key={p.id} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.supplier}</div>
                <div className="text-xs text-stone-500">{dateAR(p.date)}{p.invoiceNumber ? ` · ${p.invoiceNumber}` : ''}</div>
                <div className="text-xs text-stone-500">{p.lines.length} productos · {p.lines.reduce((a, l) => a + l.qty, 0)} u. · <b className="text-stone-900">{moneyShort(p.total)}</b></div>
              </div>
              <Link href={`/admin/compras/nueva?desde=${p.id}`} className={btnGhost + ' text-xs py-1.5 shrink-0'}><RotateCcw size={14} /> Repetir</Link>
            </li>
          ))}
        </ul>
        <div className="hidden md:block overflow-auto">
        <table className="w-full text-sm"><thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2">Fecha</th><th className="pb-2">Proveedor</th><th className="pb-2">Factura</th><th className="pb-2">Renglones</th><th className="pb-2 text-right">Total</th><th className="pb-2">Origen</th><th className="pb-2">Estado</th><th /></tr></thead>
          <tbody className="divide-y">{purchases.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-stone-400">Todavía no cargaste compras.</td></tr>}{purchases.map(p => <tr key={p.id} className="hover:bg-stone-50"><td className="py-2">{dateAR(p.date)}</td><td className="py-2 font-medium">{p.supplier}</td><td className="py-2 font-mono text-xs">{p.invoiceNumber}</td><td className="py-2">{p.lines.length} productos · {p.lines.reduce((a, l) => a + l.qty, 0)} u.</td><td className="py-2 text-right">{moneyShort(p.total)}</td><td className="py-2 text-xs">{p.source === 'foto' ? 'Foto' : p.source === 'repetida' ? 'Repetida' : 'Manual'}</td><td className="py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${p.status === 'confirmada' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{p.status}</span></td><td className="py-2 text-right"><Link href={`/admin/compras/nueva?desde=${p.id}`} className={btnGhost + ' text-xs py-1'} title="Cargar una compra nueva con los mismos productos"><RotateCcw size={14} /> Repetir</Link></td></tr>)}</tbody></table>
        </div>
        <p className="text-xs text-stone-500 mt-3">¿Volviste a comprar lo mismo? <b>Repetir</b> arma la compra nueva con los mismos productos y sólo cambiás cantidades y costos.</p>
      </Card>
    </>
  )
}

export function NewPurchase({ purchases }: { purchases: Purchase[] }) {
  const { products, settings, hasAnthropicKey } = useAdmin()
  const ai = settings.aiInvoices && hasAnthropicKey
  const nav = useRouter()
  const sp = useSearchParams()
  const [file, setFile] = useState<File | null>(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [source, setSource] = useState<'foto' | 'manual' | 'repetida'>(ai ? 'foto' : 'manual')
  const [photo, setPhoto] = useState<string | null>(null)
  const [supplier, setSupplier] = useState('')
  const [invoice, setInvoice] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<PurchaseLine[]>([])
  const [applyPrices, setApplyPrices] = useState(true)
  const [progress, setProgress] = useState(0)

  const price = (cost: number, pct: number) => roundTo(cost * (1 + pct / 100), settings.roundTo)
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const match = (desc: string) => {
    const d = norm(desc).replace(/\b(ac|aq)\b/g, 'acero').replace(/\bquir\b/g, 'quirurgico').replace(/\bdor\b/g, 'dorado').replace(/\barg\b/g, 'argollitas')
    const words = d.split(/[^a-z0-9]+/).filter(w => w.length > 2)
    let best: { p: typeof products[0]; score: number } | null = null
    for (const p of products) { const n = norm(p.name); const score = words.filter(w => n.includes(w)).length / words.length; if (score >= 0.4 && (!best || score > best.score)) best = { p, score } }
    return best
  }
  const analyze = async () => {
    if (!file) return
    setSource('foto'); setStep(1); setProgress(10); setErr('')
    const t = setInterval(() => setProgress(p => Math.min(92, p + 4)), 600)
    const fd = new FormData(); fd.set('file', file)
    const r = await readInvoicePhoto(fd)
    clearInterval(t)
    if (!r.ok) { setErr(r.error); setStep(0); return }
    const { reading } = r
    if (reading.supplier) setSupplier(reading.supplier)
    if (reading.invoiceNumber) setInvoice(reading.invoiceNumber)
    if (/^\d{4}-\d{2}-\d{2}$/.test(reading.date)) setDate(reading.date)
    setLines(reading.lines.map(l => {
      // Si Claude no reconoció el producto, probamos con el matcheo por palabras
      const p = l.productId ? products.find(p => p.id === l.productId) : match(l.description)?.p
      const pct = p?.markupPct ?? settings.defaultMarkup
      const unitCost = Math.round(l.unitCost)
      return { description: l.description, qty: Math.round(l.qty), unitCost, productId: p?.id, variant: firstVariant(p), matched: !!p, markupPct: pct, suggestedPrice: price(unitCost, pct), barcode: p?.barcode }
    }))
    setProgress(100); setStep(2)
  }
  // Reusar una compra anterior: mismos productos, cantidades y costos de aquella vez, listos para corregir.
  const reuse = (id: string) => {
    const pu = purchases.find(p => p.id === id); if (!pu) return
    setSupplier(pu.supplier); setInvoice(''); setSource('repetida')
    setLines(pu.lines.map(l => { const p = products.find(p => p.id === l.productId); const pct = p?.markupPct ?? l.markupPct ?? settings.defaultMarkup; return { ...l, variant: l.variant && p?.variantStock && l.variant in p.variantStock ? l.variant : firstVariant(p), markupPct: pct, suggestedPrice: price(l.unitCost, pct), matched: !!p } }))
    setStep(2)
  }
  useEffect(() => { const d = sp.get('desde'); if (d) reuse(d) }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const firstVariant = (p?: Product) => p?.variantStock ? Object.keys(p.variantStock)[0] : undefined
  const variantSelect = (l: PurchaseLine, i: number, cls: string) => { const p = products.find(p => p.id === l.productId); return p?.variantStock ? <select className={cls} value={l.variant ?? ''} onChange={e => upd(i, { variant: e.target.value })} aria-label="Talle">{Object.keys(p.variantStock).map(o => <option key={o} value={o}>{p.variants?.attr ? `${o}` : o}</option>)}</select> : null }
  const upd = (i: number, patch: Partial<PurchaseLine>) => setLines(ls => ls.map((x, k) => k === i ? { ...x, ...patch } : x))
  const pickProduct = (i: number, id: string) => { const p = products.find(p => p.id === id); const pct = p?.markupPct ?? settings.defaultMarkup; setLines(ls => ls.map((x, k) => k === i ? { ...x, productId: p?.id, variant: firstVariant(p), matched: !!p, barcode: p?.barcode, markupPct: pct, suggestedPrice: price(x.unitCost, pct) } : x)) }
  const setCost = (i: number, v: number) => setLines(ls => ls.map((x, k) => k === i ? { ...x, unitCost: v, suggestedPrice: price(v, x.markupPct) } : x))
  const setPct = (i: number, v: number) => setLines(ls => ls.map((x, k) => k === i ? { ...x, markupPct: v, suggestedPrice: price(x.unitCost, v) } : x))
  const removeLine = (i: number) => setLines(ls => ls.filter((_, k) => k !== i))
  const total = lines.reduce((a, l) => a + l.qty * l.unitCost, 0)
  const confirm = async () => {
    setSaving(true); setErr('')
    const r = await confirmPurchase({ supplier: supplier || 'Sin proveedor', date, invoiceNumber: invoice, lines: lines.filter(l => l.matched), source }, applyPrices)
    setSaving(false)
    if (!r.ok) { setErr(r.error); return }
    nav.push('/admin/compras')
  }

  return (
    <>
      <PageHeader title={step === 2 && source === 'repetida' ? 'Repetir compra' : step === 2 && source === 'manual' ? 'Cargar compra a mano' : 'Nueva compra'} subtitle={step === 2 && source !== 'foto' ? 'Revisá los renglones y confirmá. El stock y los costos se actualizan solos.' : 'Foto de la factura, compra repetida o carga a mano. Revisás, confirmás, y el stock y los costos se actualizan solos.'}><Link href="/admin/compras" className={btnGhost}><ArrowLeft size={16} /> Volver</Link></PageHeader>
      <div className="flex gap-2 text-xs mb-6">{(source === 'foto' ? ['1. Foto', '2. Lectura', '3. Revisión y confirmación'] : ['1. Origen', '2. Datos', '3. Revisión y confirmación']).map((s, i) => <span key={s} className={`px-3 py-1 rounded-full ${step >= i ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-500'}`}>{s}</span>)}</div>

      {step === 0 && <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <label className="block border-2 border-dashed border-stone-300 rounded-xl p-10 text-center cursor-pointer hover:bg-stone-50">
            <input type="file" accept="image/*,application/pdf" className="hidden" disabled={!ai} onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPhoto(f.type.startsWith('image/') ? URL.createObjectURL(f) : null) } }} />
            {!ai ? <><Camera size={40} className="mx-auto text-stone-300" /><div className="mt-3 font-medium text-stone-500">Lectura por foto apagada</div><div className="text-xs text-stone-500 mt-1">Se activa en <Link href="/admin/configuracion" className="underline">Configuración</Link> con la cuenta de Claude de Báltica.</div></> : photo ? <img src={photo} className="max-h-72 mx-auto rounded" alt="" /> : file ? <div className="font-medium">{file.name}</div> : <><Camera size={40} className="mx-auto text-stone-400" /><div className="mt-3 font-medium">Sacá una foto o subí la factura</div><div className="text-xs text-stone-500 mt-1">JPG, PNG o PDF. Desde el celular abre la cámara directo.</div></>}
          </label>
                    {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
          <div className="flex flex-wrap gap-2 mt-4">{ai && <button className={btnPrimary} onClick={analyze} disabled={!file}><Sparkles size={16} /> Leer factura</button>}<button className={btnGhost} onClick={() => { setSource('manual'); setLines([{ description: '', qty: 1, unitCost: 0, matched: false, markupPct: settings.defaultMarkup, suggestedPrice: 0 }]); setStep(2) }}><Upload size={16} /> Cargar a mano</button></div>
        </Card>
        <Card title="Cómo funciona el sistema de conocimiento">
          <ul className="text-sm text-stone-600 space-y-3">
            <li className="flex gap-2"><Brain size={18} className="shrink-0 text-amber-600" /><span><b>Lee la foto o el PDF</b> con Claude: renglones, cantidades, precios unitarios e IVA, aunque la factura esté torcida. <b>Es opcional</b>: usa la cuenta de Claude de Báltica (clave en Configuración) y se paga por uso a Anthropic, unos centavos por factura. Sin IA, el mismo formulario se carga a mano.</span></li>
            <li className="flex gap-2"><Link2 size={18} className="shrink-0 text-amber-600" /><span><b>Busca cada renglón en tu catálogo</b> entendiendo abreviaturas del proveedor ("AQ" = acero quirúrgico, "DOR" = dorado). Lo que no reconoce queda en gris para que lo elijas vos.</span></li>
            <li className="flex gap-2"><Sparkles size={18} className="shrink-0 text-amber-600" /><span><b>Calcula el precio final</b> con el % de ganancia de cada producto (cada uno puede tener el suyo: los anillos de acero no dejan lo mismo que la plata). Si nunca lo cargaste usa el general ({settings.defaultMarkup}%). Cambiás el % en el renglón y el precio se recalcula; el % queda guardado para la próxima factura.</span></li>
            <li className="flex gap-2"><Check size={18} className="shrink-0 text-amber-600" /><span><b>Al confirmar</b> suma el stock, guarda el nuevo costo y deja la factura archivada para buscarla después.</span></li>
          </ul>
        </Card>
      </div>}

      {step === 0 && purchases.length > 0 && <Card className="mt-4" title="O repetí una compra anterior">
        <p className="text-sm text-stone-500 mb-3">Si le volviste a comprar lo mismo al proveedor, arrancá de la factura anterior: ya vienen los productos, las cantidades y los costos de aquella vez. Sólo corregís lo que cambió.</p>
        <ul className="divide-y">{purchases.slice(0, 6).map(p => (
          <li key={p.id} className="py-2.5 flex items-center gap-3">
            <History size={16} className="text-stone-400 shrink-0" />
            <div className="flex-1 min-w-0"><div className="text-sm font-medium">{p.supplier} <span className="text-stone-400 font-normal">· {dateAR(p.date)}</span></div><div className="text-xs text-stone-500 truncate">{p.lines.map(l => l.description).join(', ')}</div></div>
            <div className="text-sm text-stone-500 whitespace-nowrap">{p.lines.length} productos · {moneyShort(p.total)}</div>
            <button className={btnPrimary + ' text-xs py-1.5'} onClick={() => reuse(p.id)}><RotateCcw size={14} /> Repetir</button>
          </li>))}</ul>
      </Card>}

      {step === 1 && <Card><div className="py-12 text-center"><Sparkles size={36} className="mx-auto text-amber-500 animate-pulse" /><div className="mt-3 font-medium">Leyendo la factura con Claude…</div><div className="text-xs text-stone-500 mt-1">Tarda entre 20 segundos y un minuto.</div><div className="w-64 h-1.5 bg-stone-200 rounded-full mx-auto mt-4 overflow-hidden"><div className="h-full bg-stone-900 transition-all" style={{ width: progress + '%' }} /></div></div></Card>}

      {step === 2 && <div className="space-y-4">
        <Card title={source === 'repetida' ? `Compra repetida a ${supplier}` : source === 'manual' ? 'Compra manual' : `Factura ${invoice} · ${supplier}`}>
          <div className="grid sm:grid-cols-3 gap-3 mb-3"><label className="text-sm">Proveedor<input className={input + ' mt-1'} value={supplier} onChange={e => setSupplier(e.target.value)} /></label><label className="text-sm">N° factura (opcional)<input className={input + ' mt-1'} value={invoice} onChange={e => setInvoice(e.target.value)} placeholder="B-0001-00004513" /></label><label className="text-sm">Fecha<input type="date" className={input + ' mt-1'} value={date} onChange={e => setDate(e.target.value)} /></label></div>
          {source === 'repetida' && <div className="mb-3"><Hint>Vienen los productos, cantidades y costos de la compra anterior. Corregí <b>cantidad</b> y <b>costo unitario</b> en cada renglón; si algo no vino esta vez, sacalo con la ✕. El % de ganancia es el actual de cada producto.</Hint></div>}
          <Hint>Revisá cada renglón. Los grises necesitan que elijas el producto o lo crees. El <b>% de ganancia</b> es el de cada producto (o el general si es nuevo): tocalo y el precio final se recalcula al instante.</Hint>
          {/* Celular: un renglón por tarjeta, con cada dato rotulado */}
          <ul className="md:hidden mt-3 space-y-3">{lines.map((l, i) => { const p = products.find(p => p.id === l.productId); return (
            <li key={i} className={`rounded-lg border p-3 space-y-2 ${l.matched ? 'bg-white' : 'bg-stone-50 border-amber-300'}`}>
              <div className="flex items-start gap-2"><input className="flex-1 min-w-0 font-mono text-xs bg-transparent border-b border-dashed py-1" value={l.description} onChange={e => upd(i, { description: e.target.value })} placeholder="Descripción en la factura" aria-label="Descripción" /><button className="text-stone-400 hover:text-red-600 px-1" aria-label="Quitar renglón" onClick={() => removeLine(i)}>✕</button></div>
              <select className={input + ' text-sm'} value={l.productId ?? ''} onChange={e => pickProduct(i, e.target.value)} aria-label="Producto"><option value="">— elegir producto —</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              {variantSelect(l, i, input + ' text-sm')}
              <div className="grid grid-cols-3 gap-2">
                <label className="text-[11px] text-stone-500">Cantidad<input className={input + ' mt-0.5 text-right'} inputMode="numeric" value={l.qty} onChange={e => upd(i, { qty: Number(e.target.value) })} /></label>
                <label className="text-[11px] text-stone-500">Costo unit.<input className={input + ' mt-0.5 text-right'} inputMode="numeric" value={l.unitCost} onChange={e => setCost(i, Number(e.target.value))} /></label>
                <label className="text-[11px] text-stone-500">% ganancia<input className={input + ' mt-0.5 text-right'} inputMode="numeric" value={l.markupPct} onChange={e => setPct(i, Number(e.target.value))} /></label>
              </div>
              <div className="flex justify-between text-xs text-stone-500"><span>{p ? <>antes: costo {moneyShort(p.cost)}{l.unitCost > p.cost && <span className="text-amber-600"> ▲</span>} · precio {moneyShort(p.price)}</> : 'Sin vincular: se ignora'}</span><span>Precio final <b className={`text-sm ${p && l.suggestedPrice > p.price ? 'text-amber-700' : 'text-stone-900'}`}>{moneyShort(l.suggestedPrice)}</b></span></div>
            </li>) })}</ul>
          <div className="overflow-auto mt-3 hidden md:block"><table className="w-full text-sm">
            <thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2">Leído en la factura</th><th className="pb-2">Producto en el sistema</th><th className="pb-2 text-right">Cant.</th><th className="pb-2 text-right">Costo unit.</th><th className="pb-2 text-right">Costo anterior</th><th className="pb-2 text-right">Precio actual</th><th className="pb-2 text-right">% ganancia</th><th className="pb-2 text-right">Precio final</th><th /></tr></thead>
            <tbody className="divide-y">{lines.map((l, i) => { const p = products.find(p => p.id === l.productId); const up = p && l.unitCost > p.cost; return (
              <tr key={i} className={l.matched ? '' : 'bg-stone-50'}>
                <td className="py-2 font-mono text-xs"><input className="bg-transparent w-full" value={l.description} onChange={e => upd(i, { description: e.target.value })} /></td>
                <td className="py-2"><select className={input + ' py-1 text-xs'} value={l.productId ?? ''} onChange={e => pickProduct(i, e.target.value)}><option value="">— elegir / crear nuevo —</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{variantSelect(l, i, input + ' py-1 text-xs mt-1')}</td>
                <td className="py-2 text-right"><input className="w-14 text-right border rounded px-1" value={l.qty} onChange={e => upd(i, { qty: Number(e.target.value) })} /></td>
                <td className="py-2 text-right"><input className="w-20 text-right border rounded px-1" value={l.unitCost} onChange={e => setCost(i, Number(e.target.value))} /></td>
                <td className="py-2 text-right text-stone-500">{p ? moneyShort(p.cost) : '—'}{up && <span className="text-amber-600 text-xs ml-1">▲</span>}</td>
                <td className="py-2 text-right text-stone-500">{p ? moneyShort(p.price) : '—'}</td>
                <td className="py-2 text-right"><div className="inline-flex items-center gap-1"><input className="w-14 text-right border rounded px-1" value={l.markupPct} onChange={e => setPct(i, Number(e.target.value))} /><span className="text-stone-400">%</span></div>{p && p.markupPct != null && p.markupPct !== l.markupPct && <div className="text-[10px] text-stone-400">antes {p.markupPct}%</div>}</td>
                <td className="py-2 text-right"><span className={`font-medium ${p && l.suggestedPrice > p.price ? 'text-amber-700' : ''}`}>{moneyShort(l.suggestedPrice)}</span>{p && l.suggestedPrice !== p.price && <div className="text-[10px] text-stone-400">{l.suggestedPrice > p.price ? '▲' : '▼'} {moneyShort(Math.abs(l.suggestedPrice - p.price))}</div>}</td>
                <td className="py-2 text-right"><button className="text-stone-400 hover:text-red-600 text-xs" onClick={() => removeLine(i)}>✕</button></td>
              </tr>) })}</tbody></table></div>
          <button className={btnGhost + ' mt-3 text-xs'} onClick={() => setLines(ls => [...ls, { description: '', qty: 1, unitCost: 0, matched: false, markupPct: settings.defaultMarkup, suggestedPrice: 0 }])}><Plus size={14} /> Agregar renglón</button>
        </Card>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><div className="text-sm text-stone-500">Total de la compra</div><div className="text-2xl font-bold">{money(total)}</div><div className="text-xs text-stone-500">{lines.reduce((a, l) => a + l.qty, 0)} unidades entran al stock · {lines.filter(l => !l.matched).length} sin vincular (se ignoran)</div></div>
            <div className="flex flex-col gap-2 items-end">
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={applyPrices} onChange={e => setApplyPrices(e.target.checked)} /> Aplicar precios sugeridos a la tienda</label>
              {err && <p className="text-sm text-red-600">{err}</p>}
              <button className={btnPrimary} onClick={confirm} disabled={!lines.some(l => l.matched) || saving}><Check size={16} /> {saving ? 'Guardando…' : 'Confirmar compra e ingresar stock'}</button>
            </div>
          </div>
        </Card>
      </div>}
    </>
  )
}
