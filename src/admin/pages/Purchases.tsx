import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, Upload, Sparkles, Check, Link2, Plus, ArrowLeft, Brain, RotateCcw, History } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { PageHeader, Card, Hint, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { money, moneyShort, dateAR, roundTo, uid } from '../../lib/format'
import type { PurchaseLine } from '../../lib/types'

export function Purchases() {
  const purchases = useStore(s => s.purchases)
  return (
    <>
      <PageHeader title="Compras y facturas" subtitle="Cargá lo que compraste a los proveedores: suma stock, actualiza el costo y calcula el precio final con el % de ganancia de cada producto. Con la lectura por foto (opcional) lo hace solo a partir de la factura.">
        <Link to="/admin/compras/nueva" className={btnGhost}><Upload size={16} /> Cargar a mano</Link>
        <Link to="/admin/compras/nueva" className={btnPrimary}><Camera size={16} /> Cargar factura por foto</Link>
      </PageHeader>
      <div className="mb-4"><Hint><b>La lectura por foto es opcional</b> y usa la cuenta de Claude (Anthropic) de Báltica: se activa en Configuración con su API key y se paga por uso a Anthropic (centavos por factura, sin abono). Sin eso, las facturas se cargan a mano con el mismo formulario.</Hint></div>
      <Card>
        <table className="w-full text-sm"><thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2">Fecha</th><th className="pb-2">Proveedor</th><th className="pb-2">Factura</th><th className="pb-2">Renglones</th><th className="pb-2 text-right">Total</th><th className="pb-2">Origen</th><th className="pb-2">Estado</th><th /></tr></thead>
          <tbody className="divide-y">{purchases.map(p => <tr key={p.id} className="hover:bg-stone-50"><td className="py-2">{dateAR(p.date)}</td><td className="py-2 font-medium">{p.supplier}</td><td className="py-2 font-mono text-xs">{p.invoiceNumber}</td><td className="py-2">{p.lines.length} productos · {p.lines.reduce((a, l) => a + l.qty, 0)} u.</td><td className="py-2 text-right">{moneyShort(p.total)}</td><td className="py-2 text-xs">{p.source === 'foto' ? 'Foto' : p.source === 'repetida' ? 'Repetida' : 'Manual'}</td><td className="py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${p.status === 'confirmada' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{p.status}</span></td><td className="py-2 text-right"><Link to={`/admin/compras/nueva?desde=${p.id}`} className={btnGhost + ' text-xs py-1'} title="Cargar una compra nueva con los mismos productos"><RotateCcw size={14} /> Repetir</Link></td></tr>)}</tbody></table>
        <p className="text-xs text-stone-500 mt-3">¿Volviste a comprar lo mismo? <b>Repetir</b> arma la compra nueva con los mismos productos y sólo cambiás cantidades y costos.</p>
      </Card>
    </>
  )
}

// Simulación del OCR + IA: en producción la foto va a un endpoint que usa un modelo de visión (Claude) con
// el catálogo como contexto. Acá "leemos" una factura ficticia para mostrar el flujo completo.
const FAKE_INVOICE = [
  { description: 'ARG CLICK BASICA AC DOR x6', qty: 6, unitCost: 1900 },
  { description: 'ANILLO ALMA AC QUIR 1.6-2.1', qty: 10, unitCost: 1450 },
  { description: 'ANILLO CORONA AQ', qty: 5, unitCost: 1500 },
  { description: 'CADENITA PATITA CORAZON AQ 45', qty: 4, unitCost: 2300 },
  { description: 'AROS GOTITAS MINI PLATA 925', qty: 3, unitCost: 6200 },
  { description: 'PERFUMERO MINI ROJO', qty: 12, unitCost: 1400 },
]

export function NewPurchase() {
  const { products, settings, addPurchase, confirmPurchase, purchases } = useStore()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [source, setSource] = useState<'foto' | 'manual' | 'repetida'>('foto')
  const [photo, setPhoto] = useState<string | null>(null)
  const [supplier, setSupplier] = useState('Acero & Co')
  const [invoice, setInvoice] = useState('B-0001-00004512')
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
  const analyze = () => {
    setSource('foto'); setStep(1); setProgress(0)
    const t = setInterval(() => setProgress(p => { if (p >= 100) { clearInterval(t); return 100 } return p + 7 }), 90)
    setTimeout(() => {
      setLines(FAKE_INVOICE.map(l => { const m = match(l.description); const pct = m?.p.markupPct ?? settings.defaultMarkup; return { ...l, productId: m?.p.id, matched: !!m, markupPct: pct, suggestedPrice: price(l.unitCost, pct), barcode: m?.p.barcode } }))
      setStep(2)
    }, 1600)
  }
  // Reusar una compra anterior: mismos productos, cantidades y costos de aquella vez, listos para corregir.
  const reuse = (id: string) => {
    const pu = purchases.find(p => p.id === id); if (!pu) return
    setSupplier(pu.supplier); setInvoice(''); setSource('repetida')
    setLines(pu.lines.map(l => { const p = products.find(p => p.id === l.productId); const pct = p?.markupPct ?? l.markupPct ?? settings.defaultMarkup; return { ...l, markupPct: pct, suggestedPrice: price(l.unitCost, pct), matched: !!p } }))
    setStep(2)
  }
  useEffect(() => { const d = sp.get('desde'); if (d) reuse(d) }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const total = lines.reduce((a, l) => a + l.qty * l.unitCost, 0)
  const confirm = () => {
    const id = 'c' + uid()
    addPurchase({ id, supplier, date: new Date().toISOString().slice(0, 10), invoiceNumber: invoice, lines, total, status: 'borrador', source })
    confirmPurchase(id, applyPrices); nav('/admin/compras')
  }

  return (
    <>
      <PageHeader title={step === 2 && source === 'repetida' ? 'Repetir compra' : step === 2 && source === 'manual' ? 'Cargar compra a mano' : 'Nueva compra'} subtitle={step === 2 && source !== 'foto' ? 'Revisá los renglones y confirmá. El stock y los costos se actualizan solos.' : 'Foto de la factura, compra repetida o carga a mano. Revisás, confirmás, y el stock y los costos se actualizan solos.'}><Link to="/admin/compras" className={btnGhost}><ArrowLeft size={16} /> Volver</Link></PageHeader>
      <div className="flex gap-2 text-xs mb-6">{(source === 'foto' ? ['1. Foto', '2. Lectura', '3. Revisión y confirmación'] : ['1. Origen', '2. Datos', '3. Revisión y confirmación']).map((s, i) => <span key={s} className={`px-3 py-1 rounded-full ${step >= i ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-500'}`}>{s}</span>)}</div>

      {step === 0 && <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <label className="block border-2 border-dashed border-stone-300 rounded-xl p-10 text-center cursor-pointer hover:bg-stone-50">
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)) }} />
            {photo ? <img src={photo} className="max-h-72 mx-auto rounded" alt="" /> : <><Camera size={40} className="mx-auto text-stone-400" /><div className="mt-3 font-medium">Sacá una foto o subí la factura</div><div className="text-xs text-stone-500 mt-1">JPG, PNG o PDF. Desde el celular abre la cámara directo.</div></>}
          </label>
          <div className="grid grid-cols-2 gap-3 mt-4"><label className="text-sm">Proveedor<input className={input + ' mt-1'} value={supplier} onChange={e => setSupplier(e.target.value)} /></label><label className="text-sm">N° factura<input className={input + ' mt-1'} value={invoice} onChange={e => setInvoice(e.target.value)} /></label></div>
          <div className="flex gap-2 mt-4"><button className={btnPrimary} onClick={analyze}><Sparkles size={16} /> {photo ? 'Leer factura' : 'Probar con una factura de ejemplo'}</button><button className={btnGhost} onClick={() => { setSource('manual'); setLines([{ description: '', qty: 1, unitCost: 0, matched: false, markupPct: settings.defaultMarkup, suggestedPrice: 0 }]); setStep(2) }}><Upload size={16} /> Cargar a mano</button></div>
        </Card>
        <Card title="Cómo funciona el sistema de conocimiento">
          <ul className="text-sm text-stone-600 space-y-3">
            <li className="flex gap-2"><Brain size={18} className="shrink-0 text-amber-600" /><span><b>Lee la foto</b> con Claude (modelo de visión): renglones, cantidades, precios unitarios, IVA y total, aunque la factura esté manuscrita o torcida. <b>Es opcional</b>: usa la cuenta de Claude de Báltica (API key en Configuración) y se paga por uso a Anthropic, unos centavos por factura. Sin IA, el mismo formulario se carga a mano.</span></li>
            <li className="flex gap-2"><Link2 size={18} className="shrink-0 text-amber-600" /><span><b>Matchea con tu catálogo</b> entendiendo abreviaturas del proveedor ("AQ" = acero quirúrgico, "DOR" = dorado). Cada vez que corregís un match, lo aprende para la próxima.</span></li>
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

      {step === 1 && <Card><div className="py-12 text-center"><Sparkles size={36} className="mx-auto text-amber-500 animate-pulse" /><div className="mt-3 font-medium">Leyendo la factura...</div><div className="text-xs text-stone-500 mt-1">{progress < 40 ? 'Detectando renglones' : progress < 75 ? 'Buscando productos en tu catálogo' : 'Calculando precios sugeridos'}</div><div className="w-64 h-1.5 bg-stone-200 rounded-full mx-auto mt-4 overflow-hidden"><div className="h-full bg-stone-900 transition-all" style={{ width: progress + '%' }} /></div></div></Card>}

      {step === 2 && <div className="space-y-4">
        <Card title={source === 'repetida' ? `Compra repetida a ${supplier}` : source === 'manual' ? 'Compra manual' : `Factura ${invoice} · ${supplier}`}>
          {source !== 'foto' && <div className="grid grid-cols-2 gap-3 mb-3"><label className="text-sm">Proveedor<input className={input + ' mt-1'} value={supplier} onChange={e => setSupplier(e.target.value)} /></label><label className="text-sm">N° factura (opcional)<input className={input + ' mt-1'} value={invoice} onChange={e => setInvoice(e.target.value)} placeholder="B-0001-00004513" /></label></div>}
          {source === 'repetida' && <div className="mb-3"><Hint>Vienen los productos, cantidades y costos de la compra anterior. Corregí <b>cantidad</b> y <b>costo unitario</b> en cada renglón; si algo no vino esta vez, sacalo con la ✕. El % de ganancia es el actual de cada producto.</Hint></div>}
          <Hint>Revisá cada renglón. Los grises necesitan que elijas el producto o lo crees. El <b>% de ganancia</b> es el de cada producto (o el general si es nuevo): tocalo y el precio final se recalcula al instante.</Hint>
          <div className="overflow-auto mt-3"><table className="w-full text-sm">
            <thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2">Leído en la factura</th><th className="pb-2">Producto en el sistema</th><th className="pb-2 text-right">Cant.</th><th className="pb-2 text-right">Costo unit.</th><th className="pb-2 text-right">Costo anterior</th><th className="pb-2 text-right">Precio actual</th><th className="pb-2 text-right">% ganancia</th><th className="pb-2 text-right">Precio final</th><th /></tr></thead>
            <tbody className="divide-y">{lines.map((l, i) => { const p = products.find(p => p.id === l.productId); const up = p && l.unitCost > p.cost; return (
              <tr key={i} className={l.matched ? '' : 'bg-stone-50'}>
                <td className="py-2 font-mono text-xs"><input className="bg-transparent w-full" value={l.description} onChange={e => setLines(ls => ls.map((x, k) => k === i ? { ...x, description: e.target.value } : x))} /></td>
                <td className="py-2"><select className={input + ' py-1 text-xs'} value={l.productId ?? ''} onChange={e => { const p = products.find(p => p.id === e.target.value); const pct = p?.markupPct ?? settings.defaultMarkup; setLines(ls => ls.map((x, k) => k === i ? { ...x, productId: p?.id, matched: !!p, barcode: p?.barcode, markupPct: pct, suggestedPrice: price(x.unitCost, pct) } : x)) }}><option value="">— elegir / crear nuevo —</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                <td className="py-2 text-right"><input className="w-14 text-right border rounded px-1" value={l.qty} onChange={e => setLines(ls => ls.map((x, k) => k === i ? { ...x, qty: Number(e.target.value) } : x))} /></td>
                <td className="py-2 text-right"><input className="w-20 text-right border rounded px-1" value={l.unitCost} onChange={e => setLines(ls => ls.map((x, k) => k === i ? { ...x, unitCost: Number(e.target.value), suggestedPrice: price(Number(e.target.value), x.markupPct) } : x))} /></td>
                <td className="py-2 text-right text-stone-500">{p ? moneyShort(p.cost) : '—'}{up && <span className="text-amber-600 text-xs ml-1">▲</span>}</td>
                <td className="py-2 text-right text-stone-500">{p ? moneyShort(p.price) : '—'}</td>
                <td className="py-2 text-right"><div className="inline-flex items-center gap-1"><input className="w-14 text-right border rounded px-1" value={l.markupPct} onChange={e => setLines(ls => ls.map((x, k) => k === i ? { ...x, markupPct: Number(e.target.value), suggestedPrice: price(x.unitCost, Number(e.target.value)) } : x))} /><span className="text-stone-400">%</span></div>{p && p.markupPct !== undefined && p.markupPct !== l.markupPct && <div className="text-[10px] text-stone-400">antes {p.markupPct}%</div>}</td>
                <td className="py-2 text-right"><span className={`font-medium ${p && l.suggestedPrice > p.price ? 'text-amber-700' : ''}`}>{moneyShort(l.suggestedPrice)}</span>{p && l.suggestedPrice !== p.price && <div className="text-[10px] text-stone-400">{l.suggestedPrice > p.price ? '▲' : '▼'} {moneyShort(Math.abs(l.suggestedPrice - p.price))}</div>}</td>
                <td className="py-2 text-right"><button className="text-stone-400 hover:text-red-600 text-xs" onClick={() => setLines(ls => ls.filter((_, k) => k !== i))}>✕</button></td>
              </tr>) })}</tbody></table></div>
          <button className={btnGhost + ' mt-3 text-xs'} onClick={() => setLines(ls => [...ls, { description: '', qty: 1, unitCost: 0, matched: false, markupPct: settings.defaultMarkup, suggestedPrice: 0 }])}><Plus size={14} /> Agregar renglón</button>
        </Card>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><div className="text-sm text-stone-500">Total de la compra</div><div className="text-2xl font-bold">{money(total)}</div><div className="text-xs text-stone-500">{lines.reduce((a, l) => a + l.qty, 0)} unidades entran al stock · {lines.filter(l => !l.matched).length} sin vincular (se ignoran)</div></div>
            <div className="flex flex-col gap-2 items-end">
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={applyPrices} onChange={e => setApplyPrices(e.target.checked)} /> Aplicar precios sugeridos a la tienda</label>
              <button className={btnPrimary} onClick={confirm} disabled={!lines.some(l => l.matched)}><Check size={16} /> Confirmar compra e ingresar stock</button>
            </div>
          </div>
        </Card>
      </div>}
    </>
  )
}
