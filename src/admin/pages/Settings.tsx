'use client'
import { useState } from 'react'
import { Sparkles, Plus, Trash2, Check, KeyRound, CreditCard } from 'lucide-react'
import { useAdmin } from '../context'
import { changePassword, createUser, saveAnthropicKey, saveSettings, setUserActive } from '../actions'
import { PageHeader, Card, Hint, input, btnPrimary, btnGhost } from '../components/AdminLayout'
import { money, roundTo } from '@/lib/format'
import type { Settings, ShippingOption } from '@/lib/types'

interface UserRow { id: number; name: string; email: string; role: 'duena' | 'vendedora'; active: boolean }

export function SettingsPage({ users, mp }: { users: UserRow[]; mp: { enabled: boolean; test: boolean; webhook: boolean } }) {
  const { settings: saved, hasAnthropicKey, user } = useAdmin()
  const [settings, setLocal] = useState<Settings>(saved)
  const [msg, setMsg] = useState('')
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved)
  const set = (patch: Partial<Settings>) => setLocal(s => ({ ...s, ...patch }))
  const save = async () => { const r = await saveSettings(settings); setMsg(r.ok ? 'Cambios guardados' : r.error); setTimeout(() => setMsg(''), 2500) }
  const setShip = (i: number, patch: Partial<ShippingOption>) => set({ shippingOptions: settings.shippingOptions.map((o, k) => k === i ? { ...o, ...patch } : o) })

  return (
    <>
      <PageHeader title="Configuración" subtitle="Reglas del negocio que usa todo el sistema.">
        <button className={btnPrimary} disabled={!dirty} onClick={save}><Check size={16} /> Guardar cambios</button>
      </PageHeader>
      {msg && <div className="fixed top-4 right-4 z-40 bg-stone-900 text-white px-4 py-2 rounded-lg text-sm">{msg}</div>}
      {dirty && <div className="md:hidden fixed bottom-4 inset-x-4 z-30"><button className={btnPrimary + ' w-full justify-center py-3 shadow-lg'} onClick={save}>Guardar cambios</button></div>}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Regla de precios">
          <label className="text-sm block">Ganancia por defecto sobre el costo (%)<input className={input + ' mt-1'} type="number" value={settings.defaultMarkup} onChange={e => set({ defaultMarkup: Number(e.target.value) })} /></label>
          <label className="text-sm block mt-3">Redondear precios a<select className={input + ' mt-1'} value={settings.roundTo} onChange={e => set({ roundTo: Number(e.target.value) })}>{[10, 50, 100, 500].map(n => <option key={n} value={n}>${n}</option>)}</select></label>
          <div className="text-xs text-stone-500 mt-3">Ejemplo: un producto que cuesta $1.500 se sugiere a <b>{money(roundTo(1500 * (1 + settings.defaultMarkup / 100), settings.roundTo))}</b>.</div>
        </Card>
        <Card title="Stock y vendedoras">
          <label className="text-sm block">Avisar cuando el stock sea menor o igual a<input className={input + ' mt-1'} type="number" value={settings.lowStockThreshold} onChange={e => set({ lowStockThreshold: Number(e.target.value) })} /></label>
          <div className="text-xs text-stone-500 mt-1">Cada producto puede tener su propio mínimo; este es el valor general.</div>
          <label className="text-sm block mt-3">Nombres para el mostrador<input className={input + ' mt-1'} value={settings.sellers.join(', ')} onChange={e => set({ sellers: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></label>
          <div className="text-xs text-stone-500 mt-1">Separados por coma. Cada venta de mostrador queda asociada a quien la cobró.</div>
        </Card>

        <Card title="Cobros de la tienda online">
          <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${mp.enabled ? (mp.test ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900') : 'bg-stone-100 text-stone-600'}`}>
            <CreditCard size={16} className="mt-0.5 shrink-0" />
            <div>{mp.enabled ? <><b>Mercado Pago conectado{mp.test ? ' en modo prueba' : ''}.</b> {mp.test ? 'Los pagos no son reales: cambiá las credenciales por las de producción para cobrar.' : 'Los clientes pagan con tarjeta, débito o dinero en cuenta.'}{!mp.webhook && ' Falta la clave secreta de webhooks (ver guía).'}</> : <><b>Mercado Pago no está conectado.</b> Se conecta cargando las credenciales de la cuenta de Báltica en el hosting (ver la guía de puesta en marcha). Mientras tanto la tienda ofrece transferencia y efectivo.</>}</div>
          </div>
          <label className="text-sm block mt-3">Descuento por transferencia (%)<input className={input + ' mt-1'} type="number" min={0} max={50} value={settings.transferDiscountPct} onChange={e => set({ transferDiscountPct: Number(e.target.value) })} /></label>
          <label className="text-sm block mt-3">Datos para transferir (los ve el cliente al confirmar)<textarea className={input + ' mt-1'} rows={3} value={settings.transferInfo} onChange={e => set({ transferInfo: e.target.value })} placeholder={'Alias: baltica.accesorios\nCBU: ...\nTitular: ...'} /></label>
          <label className="text-sm flex items-center gap-2 mt-3"><input type="checkbox" checked={settings.cashOnPickup} onChange={e => set({ cashOnPickup: e.target.checked })} /> Permitir pagar en efectivo al retirar en el showroom</label>
        </Card>

        <Card title="Envíos">
          <div className="space-y-3">
            {settings.shippingOptions.map((o, i) => (
              <div key={o.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex gap-2"><input className={input} value={o.name} onChange={e => setShip(i, { name: e.target.value })} aria-label="Nombre" /><input className={input + ' w-28'} type="number" value={o.price} onChange={e => setShip(i, { price: Number(e.target.value) })} aria-label="Precio" />{o.id !== 'retiro' && <button className="text-stone-400 hover:text-red-600" aria-label="Quitar" onClick={() => set({ shippingOptions: settings.shippingOptions.filter((_, k) => k !== i) })}><Trash2 size={16} /></button>}</div>
                <input className={input + ' text-xs'} value={o.description} onChange={e => setShip(i, { description: e.target.value })} aria-label="Descripción" placeholder="Descripción que ve el cliente" />
              </div>
            ))}
          </div>
          <button className={btnGhost + ' mt-3 text-xs'} onClick={() => set({ shippingOptions: [...settings.shippingOptions, { id: 'e' + Date.now().toString(36), name: 'Nuevo envío', price: 0, description: '' }] })}><Plus size={14} /> Agregar opción</button>
          <div className="text-xs text-stone-500 mt-2">Precio 0 = gratis. &quot;Retiro en showroom&quot; no se puede borrar (es el que habilita el pago en efectivo).</div>
        </Card>

        <Card title="Aviso arriba de la tienda">
          <label className="text-sm block">Texto de la franja (vacío = no se muestra)<input className={input + ' mt-1'} value={settings.announcement} onChange={e => set({ announcement: e.target.value })} placeholder="¡SOLO POR HOY DOMINGO! -20% en muchísimos productos ❤️" /></label>
          {settings.announcement && <div className="mt-3 bg-black text-white text-center text-sm font-bold py-2 px-3 rounded">{settings.announcement}</div>}
          <div className="text-xs text-stone-500 mt-2">Para poner productos en oferta con fecha de fin, andá a Productos, seleccionalos y usá &quot;Poner en oferta&quot;.</div>
          <label className="text-sm block mt-4">Google Analytics (ID)<input className={input + ' mt-1 font-mono'} value={settings.gaId} onChange={e => set({ gaId: e.target.value.trim() })} placeholder="G-XXXXXXX" /></label>
          <div className="text-xs text-stone-500 mt-1">Es el mismo que usaba Empretienda: las estadísticas de visitas siguen sin cortarse.</div>
        </Card>

        <Card title="Datos de contacto de la tienda">
          <label className="text-sm block">WhatsApp (con 549, sin espacios)<input className={input + ' mt-1'} value={settings.whatsapp} onChange={e => set({ whatsapp: e.target.value.replace(/\D/g, '') })} inputMode="numeric" /></label>
          <label className="text-sm block mt-3">Email<input className={input + ' mt-1'} type="email" value={settings.email} onChange={e => set({ email: e.target.value })} /></label>
          <label className="text-sm block mt-3">Instagram (link)<input className={input + ' mt-1'} value={settings.instagram} onChange={e => set({ instagram: e.target.value })} /></label>
        </Card>

        <AiCard enabled={settings.aiInvoices} onToggle={v => set({ aiInvoices: v })} hasKey={hasAnthropicKey} />

        <Card title="Copia de seguridad">
          <p className="text-sm text-stone-600">La base de datos guarda todo automáticamente. Igual conviene descargar una copia una vez por mes y guardarla en el Drive o la compu: productos, ventas, stock, compras y clientes.</p>
          <a href="/admin/respaldo" className={btnGhost + ' mt-3'}>Descargar copia de seguridad</a>
        </Card>

        {user.role === 'duena' && <Users users={users} me={user.id} />}
      </div>
    </>
  )
}

function AiCard({ enabled, onToggle, hasKey }: { enabled: boolean; onToggle: (v: boolean) => void; hasKey: boolean }) {
  const [key, setKey] = useState('')
  const [msg, setMsg] = useState('')
  return (
    <Card title="Claude: facturas por foto y migración (opcional)">
      <label className="text-sm flex items-start gap-2"><input type="checkbox" className="mt-1" checked={enabled} onChange={e => onToggle(e.target.checked)} /><span><span className="flex items-center gap-1 font-medium"><Sparkles size={14} className="text-amber-600" /> Leer facturas por foto con Claude</span><span className="text-stone-500 block mt-0.5">Usa la cuenta de Claude (Anthropic) de Báltica, no una del sistema. Se paga por uso directamente a Anthropic: una factura cuesta centavos de dólar. También ayuda a entender los archivos de Empretienda en la migración. Si está apagado, todo se carga a mano y funciona igual.</span></span></label>
      <div className="mt-4 text-sm">
        <div className="flex items-center gap-2"><KeyRound size={14} /> Clave de la cuenta de Claude: {hasKey ? <span className="text-emerald-700 font-medium">cargada</span> : <span className="text-stone-500">sin cargar</span>}</div>
        <div className="flex gap-2 mt-2"><input className={input + ' font-mono'} type="password" placeholder={hasKey ? 'Pegar una clave nueva para reemplazarla' : 'sk-ant-...'} value={key} onChange={e => setKey(e.target.value)} autoComplete="off" /><button className={btnPrimary} disabled={!key} onClick={async () => { const r = await saveAnthropicKey(key); setMsg(r.ok ? 'Clave guardada' : r.error); if (r.ok) setKey('') }}>Guardar</button></div>
        {hasKey && <button className="text-xs text-stone-500 underline mt-2" onClick={async () => { if (window.confirm('¿Borrar la clave de Claude?')) { await saveAnthropicKey(''); setMsg('Clave borrada') } }}>Borrar clave</button>}
        {msg && <p className="text-xs mt-2">{msg}</p>}
        <p className="text-xs text-stone-500 mt-2">Se crea en console.anthropic.com → API Keys, con la cuenta de Báltica y una tarjeta para el consumo. Se guarda en el servidor y nunca se muestra de nuevo.</p>
      </div>
    </Card>
  )
}

function Users({ users, me }: { users: UserRow[]; me: number }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'vendedora' as 'duena' | 'vendedora' })
  const [msg, setMsg] = useState('')
  return (
    <Card title="Usuarios del panel" className="lg:col-span-2">
      <Hint>Las <b>vendedoras</b> pueden vender, ver ventas, stock, escáner y etiquetas. No ven costos, ganancias, estadísticas ni configuración.</Hint>
      <ul className="divide-y mt-3 text-sm">{users.map(u => (
        <li key={u.id} className="py-2 flex flex-wrap items-center gap-2">
          <span className={`flex-1 min-w-40 ${u.active ? '' : 'text-stone-400 line-through'}`}>{u.name} <span className="text-stone-400">· {u.email}</span></span>
          <span className="text-xs bg-stone-100 rounded-full px-2 py-0.5">{u.role === 'duena' ? 'dueña' : 'vendedora'}</span>
          <button className="text-xs underline text-stone-500" onClick={async () => { const pw = window.prompt(`Nueva contraseña para ${u.name} (mínimo 8 caracteres)`); if (pw) { const r = await changePassword(u.id, pw); setMsg(r.ok ? 'Contraseña cambiada' : r.error) } }}>cambiar contraseña</button>
          {u.id !== me && <button className="text-xs underline text-stone-500" onClick={async () => { const r = await setUserActive(u.id, !u.active); if (!r.ok) setMsg(r.error) }}>{u.active ? 'desactivar' : 'reactivar'}</button>}
        </li>))}</ul>
      <div className="grid sm:grid-cols-5 gap-2 mt-4">
        <input className={input} placeholder="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input className={input} placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input className={input} placeholder="Contraseña (8+)" type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <select className={input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value as 'duena' | 'vendedora' })}><option value="vendedora">Vendedora</option><option value="duena">Dueña</option></select>
        <button className={btnPrimary + ' justify-center'} disabled={!form.name || !form.email || form.password.length < 8} onClick={async () => { const r = await createUser(form); setMsg(r.ok ? 'Usuario creado' : r.error); if (r.ok) setForm({ name: '', email: '', password: '', role: 'vendedora' }) }}><Plus size={14} /> Crear</button>
      </div>
      {msg && <p className="text-sm mt-2">{msg}</p>}
    </Card>
  )
}
