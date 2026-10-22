import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Info, Truck } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { categoryName, subcategoryName } from '../../data/categories'
import { money } from '../../lib/format'
import { CartDrawer } from '../components/CartDrawer'

export function ProductPage({ slug: slugProp }: { slug?: string }) {
  const params = useParams(); const slug = slugProp ?? params.slug
  const { products, addToCart } = useStore()
  const p = products.find(p => p.slug === slug)
  const [variant, setVariant] = useState<string | undefined>(p?.variants?.options[0])
  const [qty, setQty] = useState(1)
  const [open, setOpen] = useState(false)
  if (!p) return <div className="container" style={{ padding: 60 }}>Producto no encontrado.</div>
  const out = p.stock <= 0
  return (
    <div className="container">
      <nav className="sf-bc" style={{ fontSize: '.95rem' }}>
        <Link to="/">Inicio</Link><span className="sep">&gt;</span>
        <Link to={`/${p.category}`}>{categoryName(p.category)}</Link>
        {p.subcategory && <><span className="sep">&gt;</span><Link to={`/${p.category}/${p.subcategory}`}>{subcategoryName(p.subcategory)}</Link></>}
        <span className="sep">&gt;</span><span>{p.name}</span>
      </nav>
      <div className="sf-product">
        <div className="sf-gallery">
          <div className="thumbs">{(p.images ?? [p.image]).map((im, i) => <img key={i} src={im} className={i === 0 ? 'on' : ''} alt="" />)}</div>
          <div className="main"><img src={p.image} alt={p.name} /></div>
        </div>
        <div>
          <h1>{p.name}</h1>
          <p className="price">{p.offerPrice ? <><del>{money(p.price)}</del>{money(p.offerPrice)}</> : money(p.price)}</p>
          {p.variants && <>
            <p className="lbl">{p.variants.attr}</p>
            <div className="opts">{p.variants.options.map(o => <button key={o} className={'sf-opt' + (variant === o ? ' on' : '')} onClick={() => setVariant(o)}>{o}</button>)}</div>
          </>}
          <p className="lbl">Cantidad</p>
          <div className="sf-qty">
            <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <input value={qty} readOnly />
            <button onClick={() => setQty(Math.min(Math.max(1, p.stock), qty + 1))}>+</button>
          </div>
          <div>
            <button className="sf-btn lg" disabled={out} onClick={() => { addToCart({ productId: p.id, qty, variant }); setOpen(true) }}>{out ? 'Sin stock' : 'Agregar al carrito'}</button>
          </div>
          <div className="sf-note"><Info size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span>Colocar código postal 2900 (si sos de San Nicolás) o el que corresponda según tu ciudad para ver las opciones de retiros y envíos</span></div>
          <div style={{ fontWeight: 700, fontSize: '.95rem', display: 'flex', gap: 6, alignItems: 'center' }}><Truck size={16} /> Calculá el costo de envío</div>
          <div className="sf-ship"><input placeholder="Código postal" /><button>Calcular</button></div>
          {p.description && <p style={{ marginTop: 30, lineHeight: 1.6 }}>{p.description}</p>}
        </div>
      </div>
      {open && <CartDrawer onClose={() => setOpen(false)} />}
    </div>
  )
}
