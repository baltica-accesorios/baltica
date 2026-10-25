'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { money } from '@/lib/format'
import type { ShippingOption } from '@/lib/types'
import { useCart } from '../cart'
import { useMounted } from '../components/Layout'
import { checkout } from '../checkout-action'

type Pay = 'mercadopago' | 'transferencia' | 'efectivo'

export function Checkout({ shipping, transferPct, mpEnabled, cashOnPickup }: { shipping: ShippingOption[]; transferPct: number; mpEnabled: boolean; cashOnPickup: boolean }) {
  const { lines, clear } = useCart()
  const mounted = useMounted()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: 'San Nicolás', address: '', zip: '' })
  const [shipId, setShipId] = useState(shipping[0]?.id ?? '')
  const [chosen, setPayment] = useState<Pay>(mpEnabled ? 'mercadopago' : 'transferencia')
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()

  const ship = shipping.find(s => s.id === shipId)
  // Si cambia el envío y el medio elegido deja de valer (efectivo sólo al retirar), se usa el primero disponible
  const payment: Pay = chosen === 'efectivo' && !(cashOnPickup && shipId === 'retiro') ? (mpEnabled ? 'mercadopago' : 'transferencia') : chosen
  const subtotal = lines.reduce((a, l) => a + l.qty * l.price, 0)
  const discount = payment === 'transferencia' ? Math.round(subtotal * transferPct / 100) : 0
  const total = subtotal - discount + (ship?.price ?? 0)
  const pays: { id: Pay; label: string; desc: string }[] = [
    ...(mpEnabled ? [{ id: 'mercadopago' as Pay, label: 'Mercado Pago', desc: 'Tarjeta de crédito, débito, dinero en cuenta o cuotas. Pagás en Mercado Pago y volvés a la tienda.' }] : []),
    { id: 'transferencia', label: `Transferencia bancaria${transferPct ? ` · ${transferPct}% OFF` : ''}`, desc: 'Al confirmar te mostramos los datos para transferir.' },
    ...(cashOnPickup && shipId === 'retiro' ? [{ id: 'efectivo' as Pay, label: 'Efectivo al retirar', desc: 'Pagás en el showroom cuando lo retirás.' }] : []),
  ]

  if (!mounted) return <div className="container sf-page"><h1><span>Finalizar compra</span></h1></div>
  if (lines.length === 0) return <div className="container sf-page"><h1><span>Finalizar compra</span></h1><p style={{ textAlign: 'center', marginBottom: 80 }}>Tu carrito está vacío. <Link href="/productos" style={{ textDecoration: 'underline' }}>Ver productos</Link></p></div>

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    start(async () => {
      const r = await checkout({ lines: lines.map(l => ({ productId: l.productId, qty: l.qty, variant: l.variant })), customer: { ...form, address: form.address || undefined, zip: form.zip || undefined }, payment, shippingId: shipId })
      if (!r.ok) { setErr(r.error); return }
      if (payment !== 'mercadopago') clear()
      if (r.redirect.startsWith('http')) window.location.href = r.redirect
      else router.push(r.redirect)
    })
  }

  return (
    <div className="container sf-page">
      <h1><span>Finalizar compra</span></h1>
      <form className="sf-checkout" onSubmit={submit}>
        <div>
          <p className="lbl" style={{ marginTop: 0 }}>Tus datos</p>
          <input className="sf-input" required autoComplete="name" placeholder="Nombre y apellido" value={form.name} onChange={set('name')} />
          <input className="sf-input" required type="email" autoComplete="email" inputMode="email" placeholder="Email" value={form.email} onChange={set('email')} />
          <input className="sf-input" required type="tel" autoComplete="tel" inputMode="tel" placeholder="Teléfono / WhatsApp" value={form.phone} onChange={set('phone')} />

          <p className="lbl">Envío</p>
          {shipping.map(s => (
            <label key={s.id} className={'sf-choice' + (shipId === s.id ? ' on' : '')}>
              <input type="radio" name="ship" checked={shipId === s.id} onChange={() => setShipId(s.id)} />
              <div style={{ flex: 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{s.name}</b><span>{s.price ? money(s.price) : 'Gratis'}</span></div><div className="d">{s.description}</div></div>
            </label>
          ))}
          {shipId !== 'retiro' && <>
            <input className="sf-input" required autoComplete="street-address" placeholder="Dirección (calle, número, piso)" value={form.address} onChange={set('address')} style={{ marginTop: 8 }} />
            <div className="two">
              <input className="sf-input" autoComplete="address-level2" placeholder="Ciudad" value={form.city} onChange={set('city')} />
              <input className="sf-input" autoComplete="postal-code" inputMode="numeric" placeholder="Código postal" value={form.zip} onChange={set('zip')} />
            </div>
          </>}

          <p className="lbl">Medio de pago</p>
          {pays.map(m => (
            <label key={m.id} className={'sf-choice' + (payment === m.id ? ' on' : '')}>
              <input type="radio" name="pay" checked={payment === m.id} onChange={() => setPayment(m.id)} />
              <div><b>{m.label}</b><div className="d">{m.desc}</div></div>
            </label>
          ))}
          {err && <div className="sf-error" role="alert">{err}</div>}
          <button className="sf-btn lg" style={{ marginTop: 14 }} disabled={pending}>{pending ? 'Procesando…' : payment === 'mercadopago' ? `Pagar con Mercado Pago · ${money(total)}` : `Confirmar pedido · ${money(total)}`}</button>
        </div>
        <div className="summary">
          {lines.map(l => <div key={l.productId + l.variant} className="sf-row"><span>{l.qty} × {l.name}{l.variant ? ` (${l.variant})` : ''}</span><span>{money(l.qty * l.price)}</span></div>)}
          <div className="sf-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {discount > 0 && <div className="sf-row" style={{ color: '#2a7' }}><span>Descuento transferencia</span><span>−{money(discount)}</span></div>}
          <div className="sf-row"><span>Envío</span><span>{ship?.price ? money(ship.price) : 'Gratis'}</span></div>
          <div className="sf-row total"><span>Total</span><span>{money(total)}</span></div>
        </div>
      </form>
    </div>
  )
}
