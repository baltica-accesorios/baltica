'use client'
import { useActionState, useState } from 'react'
import Link from 'next/link'
import { loginCustomer, logoutCustomer, registerCustomer, requestPasswordReset, requestWholesale, resetPassword, sendMessage, updateProfile } from '../account-actions'
import { money } from '@/lib/format'

type R = { ok: true; message?: string } | { ok: false; error: string } | null
const Msg = ({ r }: { r: R }) => r ? (r.ok ? (r.message ? <div className="sf-okmsg" role="status">{r.message}</div> : null) : <div className="sf-error" role="alert">{r.error}</div>) : null

export function AuthForms({ next }: { next?: string }) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [lr, login, lp] = useActionState(loginCustomer, null)
  const [rr, register, rp] = useActionState(registerCustomer, null)
  return (
    <div className="container sf-page">
      <h1><span>Mi cuenta</span></h1>
      <div className="sf-form">
        <div className="sf-tabs">
          <button className={tab === 'login' ? 'on' : ''} onClick={() => setTab('login')}>Iniciar sesión</button>
          <button className={tab === 'register' ? 'on' : ''} onClick={() => setTab('register')}>Crear cuenta</button>
        </div>
        {tab === 'login' ? (
          <form action={login}>
            <input type="hidden" name="next" value={next ?? ''} />
            <input className="sf-input" name="email" type="email" required placeholder="Email" autoComplete="email" inputMode="email" />
            <input className="sf-input" name="password" type="password" required placeholder="Contraseña" autoComplete="current-password" />
            <Msg r={lr} />
            <button className="sf-btn lg" disabled={lp}>{lp ? 'Ingresando…' : 'Ingresar'}</button>
            <p className="sf-small"><Link href="/cuenta/recuperar">¿Olvidaste tu contraseña?</Link></p>
          </form>
        ) : (
          <form action={register}>
            <div className="two"><input className="sf-input" name="name" required placeholder="Nombre" autoComplete="given-name" /><input className="sf-input" name="surname" required placeholder="Apellido" autoComplete="family-name" /></div>
            <input className="sf-input" name="email" type="email" required placeholder="Email" autoComplete="email" inputMode="email" />
            <input className="sf-input" name="phone" type="tel" placeholder="Teléfono (opcional)" autoComplete="tel" inputMode="tel" />
            <input className="sf-input" name="password" type="password" required minLength={8} placeholder="Contraseña (mínimo 8)" autoComplete="new-password" />
            <input className="sf-input" name="password2" type="password" required minLength={8} placeholder="Repetir contraseña" autoComplete="new-password" />
            <Msg r={rr} />
            <button className="sf-btn lg" disabled={rp}>{rp ? 'Creando…' : 'Crear cuenta'}</button>
          </form>
        )}
        <p className="sf-small" style={{ marginTop: 24 }}>¿Comprás por mayor? <Link href="/cuenta/mayorista">Solicitá tu cuenta mayorista</Link></p>
      </div>
    </div>
  )
}

export function WholesaleForm({ loggedIn, status }: { loggedIn: boolean; status?: string }) {
  const [r, action, pending] = useActionState(loggedIn ? requestWholesale : registerCustomer, null)
  return (
    <div className="container sf-page">
      <h1><span>Cuenta mayorista</span></h1>
      <div className="sf-form">
        <p className="sf-small" style={{ textAlign: 'left' }}>Vas a solicitar una cuenta mayorista para acceder a nuestros precios mayoristas. La revisamos a la brevedad y te avisamos por email cuando esté aprobada.</p>
        {status === 'aprobado' ? <div className="sf-okmsg">Tu cuenta ya es mayorista: ves los precios mayoristas en toda la tienda.</div>
          : status === 'pendiente' ? <div className="sf-okmsg">Tu solicitud está en revisión. Te avisamos por email.</div> : (
          <form action={action}>
            <input type="hidden" name="wholesale" value="1" />
            {!loggedIn && <>
              <div className="two"><input className="sf-input" name="name" required placeholder="Nombre" /><input className="sf-input" name="surname" required placeholder="Apellido" /></div>
              <input className="sf-input" name="email" type="email" required placeholder="Email" inputMode="email" />
              <input className="sf-input" name="phone" type="tel" required placeholder="Teléfono" inputMode="tel" />
              <input className="sf-input" name="password" type="password" required minLength={8} placeholder="Contraseña (mínimo 8)" autoComplete="new-password" />
              <input className="sf-input" name="password2" type="password" required minLength={8} placeholder="Repetir contraseña" autoComplete="new-password" />
            </>}
            <textarea className="sf-input" name="message" rows={3} placeholder="Mensaje (opcional): tu local, ciudad, qué comprás" style={{ height: 'auto', paddingTop: 10 }} />
            <Msg r={r} />
            <button className="sf-btn lg" disabled={pending}>{pending ? 'Enviando…' : 'Enviar solicitud'}</button>
          </form>
        )}
      </div>
    </div>
  )
}

export function ResetForms({ token }: { token?: string }) {
  const [r1, req, p1] = useActionState(requestPasswordReset, null)
  const [r2, reset, p2] = useActionState(resetPassword, null)
  return (
    <div className="container sf-page">
      <h1><span>Recuperar contraseña</span></h1>
      <div className="sf-form">
        {token ? (
          <form action={reset}>
            <input type="hidden" name="token" value={token} />
            <input className="sf-input" name="password" type="password" required minLength={8} placeholder="Contraseña nueva (mínimo 8)" autoComplete="new-password" />
            <Msg r={r2} />
            <button className="sf-btn lg" disabled={p2}>Guardar contraseña</button>
          </form>
        ) : (
          <form action={req}>
            <input className="sf-input" name="email" type="email" required placeholder="Tu email" inputMode="email" />
            <Msg r={r1} />
            {!r1?.ok && <button className="sf-btn lg" disabled={p1}>{p1 ? 'Enviando…' : 'Enviarme el link'}</button>}
          </form>
        )}
      </div>
    </div>
  )
}

interface Order { number: number; createdAt: string; total: number; status: string; items: string }

export function AccountHome({ me, orders }: { me: { name: string; email: string; phone: string | null; city: string | null; wholesaleStatus: string }; orders: Order[] }) {
  const [r, action, pending] = useActionState(updateProfile, null)
  const STATUS: Record<string, string> = { pendiente: 'Pendiente de pago', pagada: 'Pagado', enviada: 'Enviado', entregada: 'Entregado', cancelada: 'Cancelado', a_resolver: 'En revisión' }
  return (
    <div className="container sf-page">
      <h1><span>Hola, {me.name.split(' ')[0]}</span></h1>
      <div className="sf-account">
        <section>
          <h2>Mis pedidos</h2>
          {orders.length === 0 ? <p className="sf-small" style={{ textAlign: 'left' }}>Todavía no hiciste pedidos. <Link href="/productos">Ver productos</Link></p> : (
            <ul className="sf-orders">{orders.map(o => (
              <li key={o.number}><div><b>Pedido #{o.number}</b> <span>{new Date(o.createdAt).toLocaleDateString('es-AR')}</span><div className="items">{o.items}</div></div><div style={{ textAlign: 'right' }}><b>{money(o.total)}</b><div className="st">{STATUS[o.status] ?? o.status}</div></div></li>
            ))}</ul>
          )}
        </section>
        <section>
          <h2>Mis datos</h2>
          <form action={action}>
            <input className="sf-input" name="name" defaultValue={me.name} required placeholder="Nombre y apellido" />
            <input className="sf-input" value={me.email} disabled aria-label="Email" />
            <input className="sf-input" name="phone" defaultValue={me.phone ?? ''} placeholder="Teléfono" inputMode="tel" />
            <input className="sf-input" name="city" defaultValue={me.city ?? ''} placeholder="Ciudad" />
            <Msg r={r} />
            <button className="sf-btn" disabled={pending}>Guardar</button>
          </form>
          <h2 style={{ marginTop: 30 }}>Cuenta mayorista</h2>
          <p className="sf-small" style={{ textAlign: 'left' }}>{me.wholesaleStatus === 'aprobado' ? 'Tu cuenta es mayorista: ves los precios mayoristas en toda la tienda.' : me.wholesaleStatus === 'pendiente' ? 'Tu solicitud está en revisión.' : me.wholesaleStatus === 'rechazado' ? 'Tu solicitud no fue aprobada. Escribinos si querés más información.' : <Link href="/cuenta/mayorista">Solicitar cuenta mayorista</Link>}</p>
          <form action={logoutCustomer}><button className="sf-btn ghost" style={{ marginTop: 20 }}>Cerrar sesión</button></form>
        </section>
      </div>
    </div>
  )
}

export function ContactForm({ kind, title, intro }: { kind: 'contacto' | 'arrepentimiento'; title: string; intro: string }) {
  const [r, action, pending] = useActionState(sendMessage, null)
  return (
    <div className="container sf-page">
      <nav className="sf-bc"><Link href="/">Inicio</Link><span className="sep">/</span><span>{title}</span></nav>
      <h1><span>{title}</span></h1>
      <div className="sf-form">
        <p className="sf-small" style={{ textAlign: 'left', whiteSpace: 'pre-line' }}>{intro}</p>
        {r?.ok ? <div className="sf-okmsg" role="status">{r.message}</div> : (
          <form action={action}>
            <input type="hidden" name="kind" value={kind} />
            <input name="website" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: -9999 }} aria-hidden="true" />
            <input className="sf-input" name="name" required placeholder="Nombre completo" autoComplete="name" />
            <input className="sf-input" name="email" type="email" required placeholder={kind === 'arrepentimiento' ? 'Email (con el que hiciste la compra)' : 'Email'} autoComplete="email" inputMode="email" />
            <input className="sf-input" name="phone" type="tel" placeholder={kind === 'arrepentimiento' ? 'Teléfono' : 'Teléfono (opcional)'} required={kind === 'arrepentimiento'} autoComplete="tel" inputMode="tel" />
            {kind === 'arrepentimiento' && <input className="sf-input" name="order" required placeholder="Número de pedido (sin #)" inputMode="numeric" />}
            <textarea className="sf-input" name="body" rows={5} required={kind === 'contacto'} placeholder={kind === 'arrepentimiento' ? 'Aclaraciones: qué productos querés devolver, dirección de retiro, otras observaciones' : 'Mensaje'} style={{ height: 'auto', paddingTop: 10 }} />
            <Msg r={r} />
            <button className="sf-btn lg" disabled={pending}>{pending ? 'Enviando…' : 'Enviar'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
