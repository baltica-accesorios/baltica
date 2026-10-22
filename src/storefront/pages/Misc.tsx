import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { money } from '../../lib/format'
import type { PaymentMethod } from '../../lib/types'

const INFO: Record<string, { title: string; body: string }> = {
  'talles-anillos': { title: 'Talles anillos', body: 'Medí el diámetro interno de un anillo que te quede bien con una regla. Los talles disponibles van de 1.5cm a 2.1cm.' },
  'cambios': { title: 'Cambios', body: 'Tenés 30 días para realizar cambios presentando el ticket. El producto debe estar sin uso y con su packaging original.' },
  'cuidados-y-limpieza': { title: 'Cuidados y limpieza', body: 'Evitá el contacto con perfumes, cremas y agua salada. Limpiá tus accesorios con un paño suave y seco.' },
  'mayoristas': { title: 'Mayoristas', body: 'Solicitá tu cuenta mayorista desde "Mi cuenta". Una vez aprobada vas a ver los precios mayoristas en toda la tienda.' },
  'contacto': { title: 'Contacto', body: 'Escribinos a baltica.sn@gmail.com o por WhatsApp al 3364349507. Showroom en San Nicolás de los Arroyos.' },
}

export function InfoPage() {
  const { page } = useParams()
  const info = INFO[page ?? '']
  if (!info) return <div className="container sf-page" style={{ padding: '40px 0' }}><h1><span>Página no encontrada</span></h1></div>
  return (
    <div className="container sf-page">
      <nav className="sf-bc"><Link to="/">Inicio</Link><span className="sep">/</span><span>{info.title}</span></nav>
      <h1><span>{info.title}</span></h1>
      <p style={{ maxWidth: 700, margin: '0 auto 80px', lineHeight: 1.7, textAlign: 'center' }}>{info.body}</p>
    </div>
  )
}

export function Checkout() {
  const { cart, products, checkoutOnline } = useStore()
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: 'San Nicolás' })
  const [payment, setPayment] = useState<PaymentMethod>('mercadopago')
  const [err, setErr] = useState('')
  const lines = cart.map(c => ({ ...c, p: products.find(p => p.id === c.productId)! }))
  const total = lines.reduce((a, l) => a + l.qty * (l.p.offerPrice ?? l.p.price), 0)
  if (cart.length === 0) return <div className="container sf-page"><h1><span>Checkout</span></h1><p style={{ textAlign: 'center', marginBottom: 80 }}>Tu carrito está vacío. <Link to="/productos" style={{ textDecoration: 'underline' }}>Ver productos</Link></p></div>
  return (
    <div className="container sf-page">
      <h1><span>Finalizar compra</span></h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, marginBottom: 80 }}>
        <div>
          <p className="lbl" style={{ fontWeight: 700, marginBottom: 12 }}>Tus datos</p>
          <input className="sf-input" placeholder="Nombre y apellido" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="sf-input" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="sf-input" placeholder="Teléfono" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input className="sf-input" placeholder="Ciudad" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          <p className="lbl" style={{ fontWeight: 700, margin: '14px 0 12px' }}>Medio de pago</p>
          {(['mercadopago', 'transferencia', 'efectivo'] as PaymentMethod[]).map(m => (
            <label key={m} style={{ display: 'flex', gap: 10, padding: '10px 0', textTransform: 'capitalize' }}><input type="radio" checked={payment === m} onChange={() => setPayment(m)} />{m === 'mercadopago' ? 'Mercado Pago' : m}{m === 'transferencia' && <span style={{ color: '#2a7', fontSize: 13 }}>10% OFF</span>}</label>
          ))}
          {err && <p style={{ color: '#c00' }}>{err}</p>}
          <button className="sf-btn lg" disabled={!form.name || !form.email} onClick={() => { const r = checkoutOnline({ ...form }, payment); if ('error' in r) setErr(r.error); else nav(`/gracias/${r.number}`) }}>Confirmar compra · {money(total)}</button>
        </div>
        <div style={{ background: '#f5f5f5', padding: 24, borderRadius: 6, alignSelf: 'start' }}>
          {lines.map(l => <div key={l.productId + l.variant} className="sf-row"><span>{l.qty} × {l.p.name}{l.variant ? ` (${l.variant})` : ''}</span><span>{money(l.qty * (l.p.offerPrice ?? l.p.price))}</span></div>)}
          <div className="sf-row total"><span>Total</span><span>{money(total)}</span></div>
        </div>
      </div>
    </div>
  )
}

export function Thanks() {
  const { n } = useParams()
  return (
    <div className="container sf-page" style={{ textAlign: 'center' }}>
      <h1><span>¡Gracias por tu compra!</span></h1>
      <p style={{ marginBottom: 20 }}>Tu pedido <strong>#{n}</strong> fue registrado. Te enviamos un email con los detalles.</p>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 80 }}>El stock ya se descontó y la venta aparece en el panel de administración en tiempo real. <Link to="/admin/ventas" style={{ textDecoration: 'underline' }}>Ver en el panel</Link></p>
    </div>
  )
}
