import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { Search, User, ShoppingBag, Menu, X, ChevronDown, Truck, Banknote, MapPin } from 'lucide-react'
import { CATEGORIES, INFO_PAGES, LOGO } from '../../data/categories'
import { useStore } from '../../store/useStore'
import { CartDrawer } from './CartDrawer'

export function StoreLayout() {
  const cart = useStore(s => s.cart)
  const count = cart.reduce((a, c) => a + c.qty, 0)
  const [cartOpen, setCartOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [q, setQ] = useState('')
  const nav = useNavigate()

  return (
    <div className="sf">
      <header className="sf-header">
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="sf-burger" onClick={() => setMenuOpen(true)} style={{ background: 'none', border: 0 }}><Menu /></button>
            <Link to="/" className="sf-logo"><img src={LOGO} alt="Báltica Accesorios" /></Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <nav className="sf-nav">
              <Link to="/">Inicio</Link>
              <div className="dd">
                <button>Productos <ChevronDown size={16} /></button>
                <div className="dd-menu">
                  <Link to="/productos">Productos <span style={{ fontWeight: 300 }}>(Ver todo)</span></Link>
                  {CATEGORIES.map(c => (
                    <div key={c.slug}>
                      <Link to={`/${c.slug}`} className="grp">{c.name}</Link>
                      {c.children?.map(s => <Link key={s.slug} to={`/${c.slug}/${s.slug}`} className="sub">{s.name}</Link>)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="dd">
                <button>Información <ChevronDown size={16} /></button>
                <div className="dd-menu">{INFO_PAGES.map(p => <Link key={p.slug} to={`/${p.slug}`}>{p.name}</Link>)}</div>
              </div>
              <Link to="/contacto">Contacto</Link>
            </nav>
            <div className="sf-icons">
              <button aria-label="Buscar" onClick={() => setSearchOpen(true)}><Search size={22} strokeWidth={1.6} /></button>
              <button aria-label="Mi cuenta" onClick={() => nav('/admin')} title="Ingresar (en el prototipo lleva al panel de administración)"><User size={22} strokeWidth={1.6} /></button>
              <button aria-label="Carrito" onClick={() => setCartOpen(true)}><ShoppingBag size={22} strokeWidth={1.6} />{count > 0 && <span className="sf-badge">{count}</span>}</button>
            </div>
          </div>
        </div>
      </header>

      {searchOpen && (
        <div className="sf-search">
          <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <input autoFocus placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { nav(`/buscar?q=${encodeURIComponent(q)}`); setSearchOpen(false) } }} />
            <button onClick={() => setSearchOpen(false)} style={{ background: 'none', border: 0, cursor: 'pointer' }}><X /></button>
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="sf-mobile-menu">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><img src={LOGO} alt="" style={{ height: 50 }} /><button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 0 }}><X /></button></div>
          <Link to="/" onClick={() => setMenuOpen(false)}>Inicio</Link>
          <Link to="/productos" onClick={() => setMenuOpen(false)}>Productos</Link>
          {CATEGORIES.map(c => <Link key={c.slug} to={`/${c.slug}`} onClick={() => setMenuOpen(false)} style={{ paddingLeft: 16, fontWeight: 400 }}>{c.name}</Link>)}
          {INFO_PAGES.map(p => <Link key={p.slug} to={`/${p.slug}`} onClick={() => setMenuOpen(false)}>{p.name}</Link>)}
          <Link to="/contacto" onClick={() => setMenuOpen(false)}>Contacto</Link>
        </div>
      )}

      <main><Outlet /></main>

      <section className="sf-info-strip">
        <div className="container">
          <div className="item"><Truck size={26} /><div className="t">Envíos a todo el país</div><div>y dentro de San Nicolás con cadete</div></div>
          <div className="item"><Banknote size={26} /><div className="t">Medios de pago</div><div>efectivo o transferencia</div></div>
          <div className="item"><MapPin size={26} /><div className="t">Showroom</div><div>en San Nicolás de los Arroyos</div></div>
        </div>
      </section>

      <footer className="sf-footer">
        <div className="container">
          <div className="cols">
            <div><h4>Medios de pago</h4><div className="ico"><span>EFECTIVO</span><span>TRANSF.</span></div></div>
            <div><h4>Medios de envío</h4><div className="ico"><span style={{ background: '#f5c400', color: '#000', fontWeight: 700 }}>CORREO</span><span>CADETE</span><span>RETIRO</span></div></div>
            <div><h4>Nuestras redes sociales</h4><a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg></a></div>
            <div><h4>Contacto</h4><div className="contact">baltica.sn@gmail.com<br />3364349507<br /><a href="#" style={{ textDecoration: 'underline' }}>Botón de arrepentimiento</a></div></div>
          </div>
          <div className="bottom">Creado con <strong style={{ letterSpacing: .5 }}>▪ empretienda</strong><span style={{ marginLeft: 'auto', color: '#999', fontSize: 12 }}>Prototipo: el frontend público replica la plantilla actual pixel a pixel. <Link to="/admin" style={{ textDecoration: 'underline' }}>Ir al panel de administración</Link></span></div>
        </div>
      </footer>

      <a className="sf-wa" href="https://wa.me/5493364349507" target="_blank" rel="noreferrer" aria-label="WhatsApp">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.3c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.3 8.3 0 1 1 12 20.3z" /></svg>
      </a>

      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    </div>
  )
}
