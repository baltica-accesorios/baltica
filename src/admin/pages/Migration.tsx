import { useState } from 'react'
import { FileSpreadsheet, Image, Users, Receipt, Check, ArrowRight } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { PageHeader, Card, Hint, btnPrimary, btnGhost } from '../components/AdminLayout'

const STEPS = [
  { icon: FileSpreadsheet, title: 'Productos y categorías', desc: 'Exportás el Excel desde Empretienda (Productos → Exportar) y lo subís acá. Se mapean nombre, categoría, precio, precio oferta, stock, SKU, variantes y dimensiones. Si no hay SKU, se genera uno y un código de barras por producto.', count: '163 productos · 19 categorías' },
  { icon: Image, title: 'Imágenes', desc: 'Se descargan desde las URLs del export y se suben al storage propio (hasta 20 por producto, igual que hoy). Las imágenes quedan optimizadas en WebP.', count: '163 imágenes' },
  { icon: Users, title: 'Clientes y mayoristas', desc: 'Export de clientes: nombre, email, teléfono, y si tiene cuenta mayorista aprobada. Las contraseñas no se migran (no se pueden exportar); los clientes reciben un email para crear una nueva.', count: '~340 clientes' },
  { icon: Receipt, title: 'Historial de ventas', desc: 'Export de ventas para no perder el historial y que las estadísticas arranquen con datos reales desde el día uno.', count: '~1.900 ventas' },
]

export function Migration() {
  const reset = useStore(s => s.reset)
  const [done, setDone] = useState<number[]>([])
  const [running, setRunning] = useState<number | null>(null)
  const run = (i: number) => { setRunning(i); setTimeout(() => { setDone(d => [...d, i]); setRunning(null) }, 1400) }
  return (
    <>
      <PageHeader title="Migrar desde Empretienda" subtitle="Un asistente de 4 pasos. Se puede correr varias veces: no duplica nada, actualiza lo que cambió. El día del cambio de dominio se corre por última vez y listo." />
      <Hint>Empretienda no tiene API pública. La migración se hace con los exports en Excel/CSV del panel (productos, clientes, ventas) y descargando las imágenes desde sus URLs. Lo hicimos funcionar con la estructura actual de la tienda.</Hint>
      <div className="space-y-3 mt-4">
        {STEPS.map((s, i) => (
          <Card key={i}>
            <div className="flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${done.includes(i) ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>{done.includes(i) ? <Check size={22} /> : <s.icon size={22} />}</div>
              <div className="flex-1 min-w-0"><div className="font-semibold">{i + 1}. {s.title}</div><div className="text-sm text-stone-500 mt-0.5">{s.desc}</div><div className="text-xs text-stone-400 mt-1">{s.count}</div></div>
              <button className={done.includes(i) ? btnGhost : btnPrimary} disabled={running !== null} onClick={() => run(i)}>{running === i ? 'Importando...' : done.includes(i) ? 'Volver a correr' : <>Importar <ArrowRight size={14} /></>}</button>
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-4" title="Plan del día del cambio">
        <ol className="text-sm space-y-2 list-decimal pl-5 text-stone-600">
          <li>Semana previa: migración completa a un dominio de prueba (ej. nueva.balticaaccesorios.com.ar). El cliente revisa producto por producto.</li>
          <li>Día D, a la mañana: última corrida del asistente (sólo trae lo que cambió desde la anterior).</li>
          <li>Se cambia el DNS del dominio al nuevo servidor. Propaga en minutos a pocas horas; mientras tanto ambas tiendas funcionan.</li>
          <li>Se pausa la tienda de Empretienda y se da de baja el plan al mes siguiente.</li>
        </ol>
      </Card>
      <div className="mt-6 text-xs text-stone-400">Prototipo: <button className="underline" onClick={() => { if (window.confirm('¿Volver los datos del prototipo al estado inicial?')) reset() }}>reiniciar datos de demo</button></div>
    </>
  )
}
