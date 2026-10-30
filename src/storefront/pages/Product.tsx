'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Info, Truck } from 'lucide-react'
import { categoryName, subcategoryName } from '@/data/categories'
import { variantPrice, variantImages, attributesOf, valuesForVariant, optionVariant, variantAvailable } from '@/lib/variants'
import { money } from '@/lib/format'
import type { PublicProduct } from '@/lib/types'
import type { Quote } from '@/lib/shipping'
import { getShippingQuotes } from '../checkout-action'
import { useCart, variantStockOf } from '../cart'
import { Price } from '../components/ProductCard'
import { offerEndLabel, offerPct } from '@/lib/pricing'

export function ProductPage({ p, shipping, initialVariant }: { p: PublicProduct; shipping: Quote[]; initialVariant?: string }) {
  const [zip, setZip] = useState('')
  const [quotes, setQuotes] = useState<Quote[] | null>(null)
  const [quoting, setQuoting] = useState(false)
  const calc = async () => { if (!/\d{4}/.test(zip)) return; setQuoting(true); setQuotes(await getShippingQuotes(zip, qty)); setQuoting(false) }
  const add = useCart(s => s.add)
  // Arranca en el primer talle con stock
  const [variant, setVariant] = useState<string | undefined>(initialVariant && variantAvailable(p, initialVariant) ? initialVariant : p.variants?.options.find(o => variantStockOf(p, o) > 0) ?? p.variants?.options[0])
  const [qty, setQty] = useState(1)
  const imgs = variantImages(p, variant)
  const [img, setImg] = useState(0)
  const avail = variantStockOf(p, variant)
  const out = p.stock <= 0 || avail <= 0
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
          <div className="main"><img src={imgs[img] ?? imgs[0]} alt={p.name} /></div>
        </div>
        <div>
          <h1>{p.name}</h1>{p.promotionLabel && <p className="sf-off">Promoción {p.promotionLabel} · se aplica al finalizar la compra</p>}
          <p className="price">{money(variantPrice(p, variant))}{p.wholesale && <span className="sf-wholesale-tag">PRECIO MAYORISTA</span>}</p>
          {offerPct(p) > 0 && <span className="sf-off">{offerPct(p)}% OFF{p.offerEndsAt ? ` hasta el ${offerEndLabel(p.offerEndsAt)} hs` : ''}</span>}
          {attributesOf(p.variants).map((a, index) => <div key={a.attr}><p className="lbl">{a.attr}</p><div className="opts">{a.options.map(option => {
            const next = optionVariant(p, variant, index, option)
            const selected = !!variant && valuesForVariant(p.variants!, variant)[index] === option
            return <button key={option} disabled={!next} aria-pressed={selected} title={!next ? `${option}: sin stock` : option} className={'sf-opt' + (selected ? ' on' : '') + (!next ? ' none' : '')} onClick={() => { setVariant(next); setQty(1); setImg(0) }}>
              {a.type === 'color' && a.colors?.[option] && <span className="sf-swatch" style={{ backgroundColor: a.colors[option] }} />}{option}
            </button>
          })}</div></div>)}
          <p className="lbl">Cantidad</p>
          <div className="sf-qty">
            <button aria-label="Quitar uno" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <input value={qty} readOnly aria-label="Cantidad" />
            <button aria-label="Agregar uno" onClick={() => setQty(Math.min(Math.max(1, avail), qty + 1))}>+</button>
          </div>
          <div>
            <button className="sf-btn lg" disabled={out} onClick={() => add(p, qty, variant)}>{p.stock <= 0 ? 'Sin stock' : out ? `Sin stock en ${variant}` : 'Agregar al carrito'}</button>
          </div>
          {!out && avail <= 3 && <p style={{ color: '#b45309', fontSize: 14, marginTop: 10 }}>{avail === 1 ? '¡Última unidad!' : `¡Últimas ${avail} unidades!`}</p>}
          <div className="sf-note"><Info size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span>Colocar código postal 2900 (si sos de San Nicolás) o el que corresponda según tu ciudad para ver las opciones de retiros y envíos</span></div>
          <div style={{ fontWeight: 700, fontSize: '.95rem', display: 'flex', gap: 6, alignItems: 'center' }}><Truck size={16} /> Calculá el costo de envío</div>
          <form className="sf-ship" onSubmit={e => { e.preventDefault(); calc() }}><input placeholder="Código postal" inputMode="numeric" maxLength={8} value={zip} onChange={e => setZip(e.target.value)} aria-label="Código postal" /><button disabled={quoting}>{quoting ? '…' : 'Calcular'}</button></form>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 14 }}>
            {(quotes ?? shipping).map(s => <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid #eee' }}><span>{s.name}{s.days && <span style={{ color: '#777' }}> · {s.days}</span>}</span><b>{s.price ? money(s.price) : 'Gratis'}</b></li>)}
          </ul>
          {p.description && <p style={{ marginTop: 30, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{p.description}</p>}
        </div>
      </div>
    </div>
  )
}
