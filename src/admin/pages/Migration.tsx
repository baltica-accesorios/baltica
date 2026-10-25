'use client'
import { useState } from 'react'
import Link from 'next/link'
import { FileSpreadsheet, Image as ImageIcon, Users, Receipt, Check, Upload, Sparkles, Loader2 } from 'lucide-react'
import { PageHeader, Card, Hint, btnPrimary, btnGhost, input } from '../components/AdminLayout'
import { analyzeFile, importImagesBatch, runImport, type Analysis, type Kind } from '../migration-actions'
import { useAdmin } from '../context'

interface Status { products: number; externalImages: number; noCost: number; customers: number; importedSales: number }

const STEPS: { kind: Kind; icon: typeof FileSpreadsheet; title: string; how: string }[] = [
  { kind: 'productos', icon: FileSpreadsheet, title: 'Productos, precios y stock', how: 'En Empretienda: Productos → Exportar productos (Excel). Trae nombre, categoría, precio, oferta, stock, SKU, variantes y las fotos.' },
  { kind: 'clientes', icon: Users, title: 'Clientes y mayoristas', how: 'En Empretienda: Clientes → Exportar. Las contraseñas no se pueden migrar (Empretienda no las da).' },
  { kind: 'ventas', icon: Receipt, title: 'Historial de ventas', how: 'En Empretienda: Ventas → Exportar. Sirve para que las estadísticas tengan historia desde el primer día. No mueve stock.' },
]

export function Migration({ status }: { status: Status }) {
  const { settings, hasAnthropicKey } = useAdmin()
  const ai = settings.aiInvoices && hasAnthropicKey
  return (
    <>
      <PageHeader title="Migrar desde Empretienda" subtitle="Subís los archivos que exportás desde el panel de Empretienda y el sistema los incorpora. Se puede repetir las veces que quieras: actualiza lo que cambió y no duplica nada." />
      <Hint>{ai ? <><b>Claude está activado:</b> lee cada archivo y reconoce solo qué columna es cada dato. Igual podés revisar y corregir antes de importar.</> : <>El sistema reconoce las columnas por su nombre y vos revisás antes de importar. Si activás Claude en <Link href="/admin/configuracion" className="underline">Configuración</Link> (con la cuenta de Báltica), las reconoce solo aunque tengan nombres raros.</>}</Hint>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm">
        <div className="bg-white rounded-xl border p-3"><div className="text-xs text-stone-500">Productos en el sistema</div><div className="text-xl font-bold">{status.products}</div></div>
        <div className="bg-white rounded-xl border p-3"><div className="text-xs text-stone-500">Fotos aún en Empretienda</div><div className={`text-xl font-bold ${status.externalImages ? 'text-amber-600' : 'text-emerald-600'}`}>{status.externalImages}</div></div>
        <div className="bg-white rounded-xl border p-3"><div className="text-xs text-stone-500">Clientes</div><div className="text-xl font-bold">{status.customers}</div></div>
        <div className="bg-white rounded-xl border p-3"><div className="text-xs text-stone-500">Ventas importadas</div><div className="text-xl font-bold">{status.importedSales}</div></div>
      </div>
      <div className="space-y-3 mt-4">
        <ImportStep n={1} step={STEPS[0]} />
        <ImagesStep n={2} remaining={status.externalImages} />
        <ImportStep n={3} step={STEPS[1]} />
        <ImportStep n={4} step={STEPS[2]} />
      </div>
      {status.noCost > 0 && <div className="mt-4"><Hint>{status.noCost} productos no tienen costo cargado. Empretienda no guarda costos: completalos en <Link href="/admin/productos" className="underline">Productos</Link> o cargando una compra, para ver la ganancia real.</Hint></div>}
      <Card className="mt-4" title="Plan del día del cambio">
        <ol className="text-sm space-y-2 list-decimal pl-5 text-stone-600">
          <li>Antes: migración completa y revisión de la tienda nueva en su dirección de prueba.</li>
          <li>Día del cambio, a la mañana: volver a subir el Excel de productos (actualiza precios y stock de ese momento) y las ventas nuevas.</li>
          <li>Paso 2 otra vez, para que no quede ninguna foto en Empretienda.</li>
          <li>Apuntar el dominio balticaaccesorios.com.ar al nuevo hosting (ver guía). Mientras propaga, las dos tiendas funcionan.</li>
          <li>Pausar la tienda de Empretienda y dar de baja el plan al mes siguiente.</li>
        </ol>
      </Card>
    </>
  )
}

function ImportStep({ n, step }: { n: number; step: typeof STEPS[0] }) {
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<'' | 'analyzing' | 'importing'>('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fd = () => { const f = new FormData(); f.set('file', file!); return f }
  const analyze = async (f: File) => {
    setFile(f); setMsg(null); setAnalysis(null); setBusy('analyzing')
    const form = new FormData(); form.set('file', f)
    const r = await analyzeFile(step.kind, form)
    setBusy('')
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return }
    setAnalysis(r.analysis); setMapping(r.analysis.mapping)
  }
  const run = async () => {
    setBusy('importing'); setMsg(null)
    const r = await runImport(step.kind, fd(), mapping)
    setBusy('')
    setMsg(r.ok ? { ok: true, text: r.summary } : { ok: false, text: r.error })
    if (r.ok) setAnalysis(null)
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${msg?.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>{msg?.ok ? <Check size={22} /> : <step.icon size={22} />}</div>
        <div className="flex-1 min-w-56"><div className="font-semibold">{n}. {step.title}</div><div className="text-sm text-stone-500 mt-0.5">{step.how}</div></div>
        <label className={btnPrimary + ' cursor-pointer'}>
          <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) analyze(f); e.target.value = '' }} />
          {busy === 'analyzing' ? <><Loader2 size={14} className="animate-spin" /> Leyendo…</> : <><Upload size={14} /> Subir archivo</>}
        </label>
      </div>
      {msg && <div className={`mt-3 text-sm rounded-lg px-3 py-2 ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}
      {analysis && (
        <div className="mt-4 border-t pt-4">
          <div className="text-sm mb-3"><b>{file?.name}</b>: {analysis.count} filas. {analysis.ai && <span className="inline-flex items-center gap-1 text-amber-700"><Sparkles size={12} /> columnas reconocidas por Claude</span>}</div>
          {analysis.notes && <p className="text-xs text-stone-500 mb-3">{analysis.notes}</p>}
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-2">
            {analysis.fields.map(f => (
              <label key={f.key} className="text-sm flex items-center gap-2">
                <span className="flex-1">{f.label}{f.required && <span className="text-red-600"> *</span>}</span>
                <select className={input + ' max-w-52 py-1'} value={mapping[f.key] ?? ''} onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))}>
                  <option value="">— no está —</option>
                  {analysis.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <details className="mt-3 text-xs text-stone-500"><summary className="cursor-pointer">Ver primeras filas del archivo</summary>
            <div className="overflow-auto mt-2"><table className="text-xs"><thead><tr>{analysis.headers.map(h => <th key={h} className="text-left pr-3 pb-1 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{analysis.sample.map((r, i) => <tr key={i}>{analysis.headers.map(h => <td key={h} className="pr-3 whitespace-nowrap max-w-48 truncate">{r[h]}</td>)}</tr>)}</tbody></table></div>
          </details>
          <div className="flex gap-2 mt-4"><button className={btnPrimary} disabled={busy !== ''} onClick={run}>{busy === 'importing' ? <><Loader2 size={14} className="animate-spin" /> Importando…</> : `Importar ${analysis.count} filas`}</button><button className={btnGhost} onClick={() => setAnalysis(null)}>Cancelar</button></div>
        </div>
      )}
    </Card>
  )
}

function ImagesStep({ n, remaining: initial }: { n: number; remaining: number }) {
  const [remaining, setRemaining] = useState(initial)
  const [running, setRunning] = useState(false)
  const [failed, setFailed] = useState(0)
  const run = async () => {
    setRunning(true); setFailed(0)
    for (;;) {
      const r = await importImagesBatch()
      setRemaining(r.remaining); setFailed(f => f + r.failed)
      if (r.remaining === 0 || r.done === 0) break
    }
    setRunning(false)
  }
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${remaining === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>{remaining === 0 ? <Check size={22} /> : <ImageIcon size={22} />}</div>
        <div className="flex-1 min-w-56"><div className="font-semibold">{n}. Traer las fotos al sistema</div><div className="text-sm text-stone-500 mt-0.5">Copia las fotos de los productos desde Empretienda a la base propia, para que sigan viéndose cuando se dé de baja el plan. {remaining > 0 ? `Faltan ${remaining} productos.` : 'Todas las fotos están en el sistema.'}</div>{failed > 0 && <div className="text-xs text-amber-700 mt-1">{failed} fotos no se pudieron bajar; volvé a intentar más tarde.</div>}</div>
        <button className={remaining ? btnPrimary : btnGhost} disabled={running || remaining === 0} onClick={run}>{running ? <><Loader2 size={14} className="animate-spin" /> Copiando… quedan {remaining}</> : 'Copiar fotos'}</button>
      </div>
    </Card>
  )
}
