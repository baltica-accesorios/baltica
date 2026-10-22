import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, Upload, Sparkles, Check, Link2, Plus, ArrowLeft, Brain } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { PageHeader, Card, Hint, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { money, moneyShort, dateAR, roundTo, uid } from '../../lib/format'
import type { PurchaseLine } from '../../lib/types'

export function Purchases() {
  const purchases = useStore(s => s.purchases)
  return (
    <>
      <PageHeader title="Compras y facturas" subtitle="Sacale una foto a la factura del proveedor: el sistema lee los renglones, los matchea con tus productos, actualiza el costo y te sugiere el precio de venta.">
        <Link to="/admin/compras/nueva" className={btnPrimary}><Camera size={16} /> Cargar factura por foto</Link>
      </PageHeader>
      <Card>
        <table className="w-full text-sm"><thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2">Fecha</th><th className="pb-2">Proveedor</th><th className="pb-2">Factura</th><th className="pb-2">Renglones</th><th className="pb-2 text-right">Total</th><th className="pb-2">Origen</th><th className="pb-2">Estado</th></tr></thead>
          <tbody className="divide-y">{purchases.map(p => <tr key={p.id}><td className="py-2">{dateAR(p.date)}</td><td className="py-2 font-medium">{p.supplier}</td><td className="py-2 font-mono text-xs">{p.invoiceNumber}</td><td className="py-2">{p.lines.length} productos · {p.lines.reduce((a, l) => a + l.qty, 0)} u.</td><td className="py-2 text-right">{moneyShort(p.total)}</td><td className="py-2 text-xs">{p.source === 'foto' ? '📷 Foto' : '✍️ Manual'}</td><td className="py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${p.status === 'confirmada' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{p.status}</span></td></tr>)}</tbody></table>
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
  { description: 'ARITOS GOTA LISA PLATA 925', qty: 3, unitCost: 6200 },
  { description: 'PERFUMERO MINI ROJO', qty: 12, unitCost: 1400 },
]

export function NewPurchase() {
  const { products, settings, addPurchase, confirmPurchase } = useStore()
  const nav = useNavigate()
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [photo, setPhoto] = useState<string | null>(null)
  const [supplier, setSupplier] = useState('Acero & Co')
  const [invoice, setInvoice] = useState('B-0001-00004512')
  const [lines, setLines] = useState<PurchaseLine[]>([])
  const [applyPrices, setApplyPrices] = useState(true)
  const [progress, setProgress] = useState(0)

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const match = (desc: string) => {
    const d = norm(desc).replace(/\b(ac|aq)\b/g, 'acero').replace(/\bquir\b/g, 'quirurgico').replace(/\bdor\b/g, 'dorado').replace(/\barg\b/g, 'argollitas')
    const words = d.split(/[^a-z0-9]+/).filter(w => w.length > 2)
    let best: { p: typeof products[0]; score: number } | null = null
    for (const p of products) { const n = norm(p.name); const score = words.filter(w => n.includes(w)).length / words.length; if (score >= 0.4 && (!best || score > best.score)) best = { p, score } }
    return best
  }
  const analyze = () => {
    setStep(1); setProgress(0)
    const t = setInterval(() => setProgress(p => { if (p >= 100) { clearInterval(t); return 100 } return p + 7 }), 90)
    setTimeout(() => {
      setLines(FAKE_INVOICE.map(l => { const m = match(l.description); return { ...l, productId: m?.p.id, matched: !!m, suggestedPrice: roundTo(l.unitCost * (1 + settings.defaultMarkup / 100), settings.roundTo), barcode: m?.p.barcode } }))
      setStep(2)
    }, 1600)
  }
  const total = lines.reduce((a, l) => a + l.qty * l.unitCost, 0)
  const confirm = () => {
    const id = 'c' + uid()
    addPurchase({ id, supplier, date: new Date().toISOString().slice(0, 10), invoiceNumber: invoice, lines, total, status: 'borrador', source: 'foto' })
    confirmPurchase(id, applyPrices); nav('/admin/compras')
  }

  return (
    <>
      <PageHeader title="Cargar factura por foto" subtitle="Tres pasos: foto, revisás lo que leyó, confirmás. El stock y los costos se actualizan solos."><Link to="/admin/compras" className={btnGhost}><ArrowLeft size={16} /> Volver</Link></PageHeader>
      <div className="flex gap-2 text-xs mb-6">{['1. Foto', '2. Lectura', '3. Revisión y confirmación'].map((s, i) => <span key={s} className={`px-3 py-1 rounded-full ${step >= i ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-500'}`}>{s}</span>)}</div>

      {step === 0 && <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <label className="block border-2 border-dashed border-stone-300 rounded-xl p-10 text-center cursor-pointer hover:bg-stone-50">
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)) }} />
            {photo ? <img src={photo} className="max-h-72 mx-auto rounded" alt="" /> : <><Camera size={40} className="mx-auto text-stone-400" /><div className="mt-3 font-medium">Sacá una foto o subí la factura</div><div className="text-xs text-stone-500 mt-1">JPG, PNG o PDF. Desde el celular abre la cámara directo.</div></>}
          </label>
          <div className="grid grid-cols-2 gap-3 mt-4"><label className="text-sm">Proveedor<input className={input + ' mt-1'} value={supplier} onChange={e => setSupplier(e.target.value)} /></label><label className="text-sm">N° factura<input className={input + ' mt-1'} value={invoice} onChange={e => setInvoice(e.target.value)} /></label></div>
          <div className="flex gap-2 mt-4"><button className={btnPrimary} onClick={analyze}><Sparkles size={16} /> {photo ? 'Leer factura' : 'Probar con una factura de ejemplo'}</button><button className={btnGhost} onClick={() => { setLines([{ description: '', qty: 1, unitCost: 0, matched: false, suggestedPrice: 0 }]); setStep(2) }}><Upload size={16} /> Cargar a mano</button></div>
        </Card>
        <Card title="Cómo funciona el sistema de conocimiento">
          <ul className="text-sm text-stone-600 space-y-3">
            <li className="flex gap-2"><Brain size={18} className="shrink-0 text-amber-600" /><span><b>Lee la foto</b> con un modelo de visión: renglones, cantidades, precios unitarios, IVA y total, aunque la factura esté manuscrita o torcida.</span></li>
            <li className="flex gap-2"><Link2 size={18} className="shrink-0 text-amber-600" /><span><b>Matchea con tu catálogo</b> entendiendo abreviaturas del proveedor ("AQ" = acero quirúrgico, "DOR" = dorado). Cada vez que corregís un match, lo aprende para la próxima.</span></li>
            <li className="flex gap-2"><Sparkles size={18} className="shrink-0 text-amber-600" /><span><b>Sugiere el precio de venta</b> con tu regla de ganancia (hoy: costo + {settings.defaultMarkup}%, redondeado a ${settings.roundTo}). Si el costo subió, te avisa cuánto deberías subir el precio.</span></li>
            <li className="flex gap-2"><Check size={18} className="shrink-0 text-amber-600" /><span><b>Al confirmar</b> suma el stock, guarda el nuevo costo y deja la factura archivada para buscarla después.</span></li>
          </ul>
        </Card>
      </div>}

      {step === 1 && <Card><div className="py-12 text-center"><Sparkles size={36} className="mx-auto text-amber-500 animate-pulse" /><div className="mt-3 font-medium">Leyendo la factura...</div><div className="text-xs text-stone-500 mt-1">{progress < 40 ? 'Detectando renglones' : progress < 75 ? 'Buscando productos en tu catálogo' : 'Calculando precios sugeridos'}</div><div className="w-64 h-1.5 bg-stone-200 rounded-full mx-auto mt-4 overflow-hidden"><div className="h-full bg-stone-900 transition-all" style={{ width: progress + '%' }} /></div></div></Card>}

      {step === 2 && <div className="space-y-4">
        <Card title={`Factura ${invoice} · ${supplier}`}>
          <Hint>Revisá cada renglón. Los que están en verde ya se vincularon a un producto tuyo. Los grises necesitan que elijas el producto o lo crees.</Hint>
          <div className="overflow-auto mt-3"><table className="w-full text-sm">
            <thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2">Leído en la factura</th><th className="pb-2">Producto en el sistema</th><th className="pb-2 text-right">Cant.</th><th className="pb-2 text-right">Costo unit.</th><th className="pb-2 text-right">Costo anterior</th><th className="pb-2 text-right">Precio actual</th><th className="pb-2 text-right">Precio sugerido</th><th /></tr></thead>
            <tbody className="divide-y">{lines.map((l, i) => { const p = products.find(p => p.id === l.productId); const up = p && l.unitCost > p.cost; return (
              <tr key={i} className={l.matched ? '' : 'bg-stone-50'}>
                <td className="py-2 font-mono text-xs"><input className="bg-transparent w-full" value={l.description} onChange={e => setLines(ls => ls.map((x, k) => k === i ? { ...x, description: e.target.value } : x))} /></td>
                <td className="py-2"><select className={input + ' py-1 text-xs'} value={l.productId ?? ''} onChange={e => { const p = products.find(p => p.id === e.target.value); setLines(ls => ls.map((x, k) => k === i ? { ...x, productId: p?.id, matched: !!p, barcode: p?.barcode } : x)) }}><option value="">— elegir / crear nuevo —</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                <td className="py-2 text-right"><input className="w-14 text-right border rounded px-1" value={l.qty} onChange={e => setLines(ls => ls.map((x, k) => k === i ? { ...x, qty: Number(e.target.value) } : x))} /></td>
                <td className="py-2 text-right"><input className="w-20 text-right border rounded px-1" value={l.unitCost} onChange={e => setLines(ls => ls.map((x, k) => k === i ? { ...x, unitCost: Number(e.target.value), suggestedPrice: roundTo(Number(e.target.value) * (1 + settings.defaultMarkup / 100), settings.roundTo) } : x))} /></td>
                <td className="py-2 text-right text-stone-500">{p ? moneyShort(p.cost) : '—'}{up && <span className="text-amber-600 text-xs ml-1">▲</span>}</td>
                <td className="py-2 text-right text-stone-500">{p ? moneyShort(p.price) : '—'}</td>
                <td className="py-2 text-right"><input className={`w-20 text-right border rounded px-1 ${p && l.suggestedPrice > p.price ? 'border-amber-400 bg-amber-50' : ''}`} value={l.suggestedPrice} onChange={e => setLines(ls => ls.map((x, k) => k === i ? { ...x, suggestedPrice: Number(e.target.value) } : x))} /></td>
                <td className="py-2 text-right"><button className="text-stone-400 hover:text-red-600 text-xs" onClick={() => setLines(ls => ls.filter((_, k) => k !== i))}>✕</button></td>
              </tr>) })}</tbody></table></div>
          <button className={btnGhost + ' mt-3 text-xs'} onClick={() => setLines(ls => [...ls, { description: '', qty: 1, unitCost: 0, matched: false, suggestedPrice: 0 }])}><Plus size={14} /> Agregar renglón</button>
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
