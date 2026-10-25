'use client'
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { money } from '@/lib/format'
import type { Quote } from '@/lib/shipping'
import { useCart } from '../cart'
import { useMounted } from '../components/Layout'
import { checkout, getShippingQuotes, previewCoupon } from '../checkout-action'

type Pay = 'mercadopago' | 'transferencia' | 'efectivo'

export function Checkout({ shipping, transferPct, mpEnabled, cashOnPickup, me }: { shipping: Quote[]; transferPct: number; mpEnabled: boolean; cashOnPickup: boolean; me: { name: string; email: string; phone: string; city: string } | null }) {
  const { lines, clear } = useCart()
  const mounted = useMounted()
  const router = useRouter()
  const [form, setForm] = useState({ name: me?.name ?? '', email: me?.email ?? '', phone: me?.phone ?? '', city: me?.city || 'San Nicolás', address: '', zip: '' })
  const [quotes, setQuotes] = useState<Quote[]>(shipping)
  const [shipId, setShipId] = useState(shipping[0]?.id ?? '')
  const [quoting, setQuoting] = useState(false)
  const [chosen, setPayment] = useState<Pay>(mpEnabled ? 'mercadopago' : 'transferencia')
  const [err, setErr] = useState('')
  const [pending, start] = useTransition()
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<{ code: string; discount: number; freeShipping: boolean; label: string } | null>(null)
  const [couponMsg, setCouponMsg] = useState('')

  const ship = quotes.find(s => s.id === shipId)
  const units = lines.reduce((a, l) => a + l.qty, 0)
  const zip4 = form.zip.match(/\d{4}/)?.[0] ?? ''
  // Cotiza solo cuando hay un código postal de 4 dígitos
  useEffect(() => {
    let cancel = false
    setQuoting(!!zip4)
    const t = setTimeout(async () => {
      const q = await getShippingQuotes(zip4, units)
      if (cancel) return
      setQuotes(q); setQuoting(false)
      setShipId(id => q.some(x => x.id === id) ? id : q[0]?.id ?? '')
    }, zip4 ? 300 : 0)
    return () => { cancel = true; clearTimeout(t) }
  }, [zip4, units])
  // Si cambia el envío y el medio elegido deja de valer (efectivo sólo al retirar), se usa el primero disponible
  const payment: Pay = chosen === 'efectivo' && !(cashOnPickup && shipId === 'retiro') ? (mpEnabled ? 'mercadopago' : 'transferencia') : chosen
  const subtotal = lines.reduce((a, l) => a + l.qty * l.price, 0)
  const couponDiscount = coupon?.discount ?? 0
  const discount = payment === 'transferencia' ? Math.round((subtotal - couponDiscount) * transferPct / 100) : 0
  const shipCost = coupon?.freeShipping ? 0 : ship?.price ?? 0
  const total = subtotal - couponDiscount - discount + shipCost
  const applyCoupon = async () => { setCouponMsg(''); const r = await previewCoupon(couponInput, subtotal); if (r.ok) setCoupon(r); else { setCoupon(null); setCouponMsg(r.error) } }
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
      const r = await checkout({ lines: lines.map(l => ({ productId: l.productId, qty: l.qty, variant: l.variant })), customer: { ...form, address: form.address || undefined, zip: form.zip || undefined }, payment, shippingId: shipId, coupon: coupon?.code })
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
          <p className="lbl" style={{ marginTop: 0 }}>Tus datos {!me && <span style={{ fontWeight: 400, fontSize: 13 }}>· <Link href="/cuenta?next=/checkout" style={{ textDecoration: 'underline' }}>¿Ya tenés cuenta? Ingresá</Link></span>}</p>
          <input className="sf-input" required autoComplete="name" placeholder="Nombre y apellido" value={form.name} onChange={set('name')} />
          <input className="sf-input" required type="email" autoComplete="email" inputMode="email" placeholder="Email" value={form.email} onChange={set('email')} />
          <input className="sf-input" required type="tel" autoComplete="tel" inputMode="tel" placeholder="Teléfono / WhatsApp" value={form.phone} onChange={set('phone')} />

          <p className="lbl">Envío</p>
          <input className="sf-input" autoComplete="postal-code" inputMode="numeric" maxLength={8} placeholder="Tu código postal (ej. 2900)" value={form.zip} onChange={set('zip')} aria-label="Código postal" />
          {quoting && <p className="sf-small" style={{ textAlign: 'left', marginTop: -6 }}>Calculando envío…</p>}
          {!/\d{4}/.test(form.zip) && <p className="sf-small" style={{ textAlign: 'left', marginTop: -6 }}>Poné tu código postal para ver los envíos a tu casa.</p>}
          {quotes.map(s => (
            <label key={s.id} className={'sf-choice' + (shipId === s.id ? ' on' : '')}>
              <input type="radio" name="ship" checked={shipId === s.id} onChange={() => setShipId(s.id)} />
              <div style={{ flex: 1 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{s.name}</b><span>{s.price ? money(s.price) : 'Gratis'}</span></div><div className="d">{s.description}{s.days ? ` · ${s.days}` : ''}</div></div>
            </label>
          ))}
          {shipId !== 'retiro' && <>
            <input className="sf-input" required autoComplete="street-address" placeholder="Dirección (calle, número, piso)" value={form.address} onChange={set('address')} style={{ marginTop: 8 }} />
            <input className="sf-input" autoComplete="address-level2" placeholder="Ciudad" value={form.city} onChange={set('city')} />
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
          <div className="sf-coupon">
            {coupon ? <div className="sf-row" style={{ color: '#2a7' }}><span>Cupón {coupon.code} · {coupon.label} <button type="button" className="link" onClick={() => setCoupon(null)}>quitar</button></span><span>{couponDiscount ? `−${money(couponDiscount)}` : ''}</span></div>
              : <div style={{ display: 'flex', gap: 8, padding: '10px 0' }}><input className="sf-input" style={{ margin: 0, height: 40 }} placeholder="¿Tenés un cupón de descuento?" value={couponInput} onChange={e => setCouponInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon() } }} aria-label="Cupón" /><button type="button" className="sf-btn ghost" style={{ height: 40 }} disabled={!couponInput.trim()} onClick={applyCoupon}>Aplicar</button></div>}
            {couponMsg && <div style={{ color: '#a00', fontSize: 13, paddingBottom: 6 }}>{couponMsg}</div>}
          </div>
          {discount > 0 && <div className="sf-row" style={{ color: '#2a7' }}><span>Descuento transferencia</span><span>−{money(discount)}</span></div>}
          <div className="sf-row"><span>Envío</span><span>{shipCost ? money(shipCost) : 'Gratis'}</span></div>
          <div className="sf-row total"><span>Total</span><span>{money(total)}</span></div>
        </div>
      </form>
    </div>
  )
}
