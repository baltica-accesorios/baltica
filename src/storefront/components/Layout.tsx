'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, User, ShoppingBag, Menu, X, ChevronDown, Truck, CreditCard, MapPin } from 'lucide-react'
import { CATEGORIES, INFO_PAGES, LOGO } from '@/data/categories'
import { useCart } from '../cart'
import { CartDrawer } from './CartDrawer'

export interface StoreContact { whatsapp: string; email: string; instagram: string; mpEnabled: boolean; announcement: string }

export function useMounted() {
  const [m, setM] = useState(false)
  useEffect(() => setM(true), [])
  return m
}

export function StoreLayout({ contact, children }: { contact: StoreContact; children: React.ReactNode }) {
  const count = useCart(s => s.lines.reduce((a, c) => a + c.qty, 0))
  const { open: cartOpen, setOpen: setCartOpen } = useCart()
  const mounted = useMounted()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [q, setQ] = useState('')
  const nav = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    setMenuOpen(false); setCartOpen(false)
    // Cierra el desplegable del menú después de elegir una categoría (queda abierto por el foco)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }, [pathname, setCartOpen])
  const phone = contact.whatsapp.replace(/^549/, '')

  return (
    <div className="sf">
      {contact.announcement && <div className="sf-announce">{contact.announcement}</div>}
      <header className="sf-header">
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="sf-burger" aria-label="Menú" onClick={() => setMenuOpen(true)} style={{ background: 'none', border: 0 }}><Menu /></button>
            <Link href="/" className="sf-logo"><img src={LOGO} alt="Báltica Accesorios" /></Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <nav className="sf-nav">
              <Link href="/">Inicio</Link>
              <div className="dd">
                <button>Productos <ChevronDown size={16} /></button>
                <div className="dd-menu">
                  <Link href="/productos">Productos <span style={{ fontWeight: 300 }}>(Ver todo)</span></Link>
                  {CATEGORIES.map(c => (
                    <div key={c.slug}>
                      <Link href={`/${c.slug}`} className="grp">{c.name}</Link>
                      {c.children?.map(s => <Link key={s.slug} href={`/${c.slug}/${s.slug}`} className="sub">{s.name}</Link>)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="dd">
                <button>Información <ChevronDown size={16} /></button>
                <div className="dd-menu">{INFO_PAGES.map(p => <Link key={p.slug} href={`/${p.slug}`}>{p.name}</Link>)}</div>
              </div>
              <Link href="/contacto">Contacto</Link>
            </nav>
            <div className="sf-icons">
              <button aria-label="Buscar" onClick={() => setSearchOpen(true)}><Search size={22} strokeWidth={1.6} /></button>
              <Link aria-label="Mi cuenta" href="/cuenta" className="sf-icon-account"><User size={22} strokeWidth={1.6} /></Link>
              <button aria-label="Carrito" onClick={() => setCartOpen(true)}><ShoppingBag size={22} strokeWidth={1.6} />{mounted && count > 0 && <span className="sf-badge">{count}</span>}</button>
            </div>
          </div>
        </div>
      </header>

      {searchOpen && (
        <div className="sf-search">
          <form className="container" style={{ display: 'flex', alignItems: 'center', gap: 16 }} onSubmit={e => { e.preventDefault(); if (q.trim()) { nav.push(`/buscar?q=${encodeURIComponent(q.trim())}`); setSearchOpen(false) } }}>
            <input autoFocus type="search" enterKeyHint="search" placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} />
            <button type="button" aria-label="Cerrar búsqueda" onClick={() => setSearchOpen(false)} style={{ background: 'none', border: 0, cursor: 'pointer' }}><X /></button>
          </form>
        </div>
      )}

      {menuOpen && (
        <div className="sf-mobile-menu">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><img src={LOGO} alt="" style={{ height: 50 }} /><button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 0 }}><X /></button></div>
          <Link href="/">Inicio</Link>
          <Link href="/productos">Productos</Link>
          {CATEGORIES.map(c => <Link key={c.slug} href={`/${c.slug}`} style={{ paddingLeft: 16, fontWeight: 400 }}>{c.name}</Link>)}
          {INFO_PAGES.map(p => <Link key={p.slug} href={`/${p.slug}`}>{p.name}</Link>)}
          <Link href="/contacto">Contacto</Link>
        </div>
      )}

      <main>{children}</main>

      <section className="sf-info-strip">
        <div className="container">
          <div className="item"><Truck size={26} /><div className="t">Envíos a todo el país</div><div>y dentro de San Nicolás con cadete</div></div>
          <div className="item"><CreditCard size={26} /><div className="t">Medios de pago</div><div>{contact.mpEnabled ? 'Mercado Pago, transferencia o efectivo' : 'efectivo o transferencia'}</div></div>
          <div className="item"><MapPin size={26} /><div className="t">Showroom</div><div>en San Nicolás de los Arroyos</div></div>
        </div>
      </section>

      <footer className="sf-footer">
        <div className="container">
          <div className="cols">
            <div><h4>Medios de pago</h4><div className="ico">{contact.mpEnabled && <span style={{ background: '#009ee3', color: '#fff', fontWeight: 700 }}>MERCADO PAGO</span>}<span>EFECTIVO</span><span>TRANSF.</span></div></div>
            <div><h4>Medios de envío</h4><div className="ico"><span style={{ background: '#f5c400', color: '#000', fontWeight: 700 }}>CORREO</span><span>CADETE</span><span>RETIRO</span></div></div>
            <div><h4>Nuestras redes sociales</h4><a href={contact.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg></a></div>
            <div><h4>Contacto</h4><div className="contact">{contact.email}<br />{phone}<br /><Link href="/arrepentimiento" style={{ textDecoration: 'underline' }}>Botón de arrepentimiento</Link></div></div>
          </div>
          <div className="bottom">© {new Date().getFullYear()} Báltica Accesorios</div>
        </div>
      </footer>

      <a className="sf-wa" href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.3c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.3 8.3 0 1 1 12 20.3z" /></svg>
      </a>

      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    </div>
  )
}
