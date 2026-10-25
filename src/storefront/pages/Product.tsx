'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Info, Truck } from 'lucide-react'
import { categoryName, subcategoryName } from '@/data/categories'
import { money } from '@/lib/format'
import type { PublicProduct, ShippingOption } from '@/lib/types'
import { useCart } from '../cart'
import { Price } from '../components/ProductCard'
import { offerEndLabel, offerPct } from '@/lib/pricing'

export function ProductPage({ p, shipping }: { p: PublicProduct; shipping: ShippingOption[] }) {
  const add = useCart(s => s.add)
  const [variant, setVariant] = useState<string | undefined>(p.variants?.options[0])
  const [qty, setQty] = useState(1)
  const imgs = p.images?.length ? p.images : [p.image]
  const [img, setImg] = useState(0)
  const out = p.stock <= 0
  return (
    <div className="container">
      <nav className="sf-bc" style={{ fontSize: '.95rem' }}>
        <Link href="/">Inicio</Link><span className="sep">&gt;</span>
        <Link href={`/${p.category}`}>{categoryName(p.category)}</Link>
        {p.subcategory && <><span className="sep">&gt;</span><Link href={`/${p.category}/${p.subcategory}`}>{subcategoryName(p.subcategory)}</Link></>}
        <span className="sep">&gt;</span><span>{p.name}</span>
      </nav>
      <div className="sf-product">
        <div className="sf-gallery">
          {imgs.length > 1 && <div className="thumbs">{imgs.map((im, i) => <img key={i} src={im} className={i === img ? 'on' : ''} alt="" onClick={() => setImg(i)} />)}</div>}
          <div className="main"><img src={imgs[img]} alt={p.name} /></div>
        </div>
        <div>
          <h1>{p.name}</h1>
          <p className="price"><Price p={p} /></p>
          {offerPct(p) > 0 && <span className="sf-off">{offerPct(p)}% OFF{p.offerEndsAt ? ` hasta el ${offerEndLabel(p.offerEndsAt)} hs` : ''}</span>}
          {p.variants && p.variants.options.length > 0 && <>
            <p className="lbl">{p.variants.attr}</p>
            <div className="opts">{p.variants.options.map(o => <button key={o} className={'sf-opt' + (variant === o ? ' on' : '')} onClick={() => setVariant(o)}>{o}</button>)}</div>
          </>}
          <p className="lbl">Cantidad</p>
          <div className="sf-qty">
            <button aria-label="Quitar uno" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <input value={qty} readOnly aria-label="Cantidad" />
            <button aria-label="Agregar uno" onClick={() => setQty(Math.min(Math.max(1, p.stock), qty + 1))}>+</button>
          </div>
          <div>
            <button className="sf-btn lg" disabled={out} onClick={() => add(p, qty, variant)}>{out ? 'Sin stock' : 'Agregar al carrito'}</button>
          </div>
          {!out && p.stock <= 3 && <p style={{ color: '#b45309', fontSize: 14, marginTop: 10 }}>¡Últimas {p.stock} unidades!</p>}
          <div className="sf-note"><Info size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span>Podés retirar gratis en nuestro showroom de San Nicolás o recibirlo en tu casa.</span></div>
          <div style={{ fontWeight: 700, fontSize: '.95rem', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}><Truck size={16} /> Opciones de envío</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 14 }}>
            {shipping.map(s => <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid #eee' }}><span>{s.name}</span><b>{s.price ? money(s.price) : 'Gratis'}</b></li>)}
          </ul>
          {p.description && <p style={{ marginTop: 30, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{p.description}</p>}
        </div>
      </div>
    </div>
  )
}
