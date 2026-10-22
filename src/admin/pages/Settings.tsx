import { useStore } from '../../store/useStore'
import { PageHeader, Card, Hint, input } from '../components/AdminLayout'
import { Sparkles } from 'lucide-react'
import { money, roundTo } from '../../lib/format'

export function SettingsPage() {
  const { settings, setSettings } = useStore()
  return (
    <>
      <PageHeader title="Configuración" subtitle="Reglas del negocio que usa todo el sistema." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Regla de precios">
          <label className="text-sm block">Ganancia por defecto sobre el costo (%)<input className={input + ' mt-1'} type="number" value={settings.defaultMarkup} onChange={e => setSettings({ defaultMarkup: Number(e.target.value) })} /></label>
          <label className="text-sm block mt-3">Redondear precios a<select className={input + ' mt-1'} value={settings.roundTo} onChange={e => setSettings({ roundTo: Number(e.target.value) })}>{[10, 50, 100, 500].map(n => <option key={n} value={n}>${n}</option>)}</select></label>
          <div className="text-xs text-stone-500 mt-3">Ejemplo: un producto que cuesta $1.500 se sugiere a <b>{money(roundTo(1500 * (1 + settings.defaultMarkup / 100), settings.roundTo))}</b>.</div>
        </Card>
        <Card title="Stock">
          <label className="text-sm block">Avisar cuando el stock sea menor o igual a<input className={input + ' mt-1'} type="number" value={settings.lowStockThreshold} onChange={e => setSettings({ lowStockThreshold: Number(e.target.value) })} /></label>
          <div className="text-xs text-stone-500 mt-2">Cada producto puede tener su propio mínimo; este es el valor general.</div>
        </Card>
        <Card title="Vendedoras">
          <input className={input} value={settings.sellers.join(', ')} onChange={e => setSettings({ sellers: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
          <div className="text-xs text-stone-500 mt-2">Separadas por coma. Cada venta de mostrador queda asociada a quien la cobró.</div>
        </Card>
        <Card title="Lectura de facturas con IA (opcional)">
          <label className="text-sm flex items-start gap-2"><input type="checkbox" className="mt-1" checked={settings.aiInvoices} onChange={e => setSettings({ aiInvoices: e.target.checked })} /><span><span className="flex items-center gap-1 font-medium"><Sparkles size={14} className="text-amber-600" /> Leer facturas por foto con Claude</span><span className="text-stone-500 block mt-0.5">Usa la cuenta de Claude (Anthropic) de Báltica, no una del sistema. Se paga por uso a Anthropic: una factura cuesta centavos de dólar. Si está apagado, las facturas se cargan a mano y todo lo demás funciona igual.</span></span></label>
          {settings.aiInvoices && <label className="text-sm block mt-3">API key de Anthropic<input className={input + ' mt-1 font-mono'} type="password" placeholder="sk-ant-..." value={settings.anthropicKey ?? ''} onChange={e => setSettings({ anthropicKey: e.target.value })} /><span className="text-xs text-stone-500">Se obtiene en console.anthropic.com. En producción se guarda cifrada en el servidor, nunca en el navegador.</span></label>}
        </Card>
        <Card title="Tienda">
          <label className="text-sm block">Nombre<input className={input + ' mt-1'} value={settings.storeName} onChange={e => setSettings({ storeName: e.target.value })} /></label>
          <Hint>En producción acá también van: medios de pago (Mercado Pago, transferencia con descuento), envíos (Correo Argentino, cadete, retiro), cupones, usuarios y permisos, y el editor de banners del inicio.</Hint>
        </Card>
      </div>
    </>
  )
}
