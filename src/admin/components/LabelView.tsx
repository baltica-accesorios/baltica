'use client'
// Dibuja una etiqueta en milímetros reales: lo que se ve en pantalla es lo que sale en la impresora.
import { Barcode } from './Scanner'
import { money } from '@/lib/format'
import { currentPrice } from '@/lib/pricing'
import type { LabelField, LabelLayout, LabelTemplate, Product } from '@/lib/types'
import { LOGO } from '@/data/categories'

export const FIELD_LABEL: Record<LabelField, string> = { logo: 'Logo', store: 'Nombre de la tienda', name: 'Nombre del producto', barcode: 'Código de barras', price: 'Precio', sku: 'SKU (código interno)', text: 'Texto libre' }
export const ALL_FIELDS: LabelField[] = ['logo', 'store', 'name', 'barcode', 'price', 'sku', 'text']

/** Diseño de una plantilla; las plantillas viejas (sin diseño guardado) se convierten con valores proporcionados a su tamaño. */
export function layoutOf(t: LabelTemplate): LabelLayout {
  if (t.layout) return t.layout
  const h = t.heightMm
  const order: LabelField[] = [...(t.showName ? ['name' as const] : []), 'barcode', ...(t.showPrice ? ['price' as const] : []), ...(t.showSku ? ['sku' as const] : [])]
  return {
    order, align: 'center', storeText: 'BÁLTICA', customText: '',
    nameSize: Math.max(4.5, Math.round(h * 0.24)), priceSize: Math.max(5.5, Math.round(h * 0.4)), skuSize: Math.max(3.5, Math.round(h * 0.18)), storeSize: Math.max(5, Math.round(h * 0.26)), textSize: Math.max(4, Math.round(h * 0.18)),
    barcodeHeight: Math.max(3, Math.round(h * 0.25)), barcodeNumber: h >= 15, priceBold: true, showCents: false, border: false, gapMm: 2, paddingMm: h < 15 ? 0.5 : 1,
  }
}

const MM = 3.78 // px por mm en pantalla (96 dpi)

export function LabelView({ t, p, layout }: { t: LabelTemplate; p: Product; layout?: LabelLayout }) {
  const l = layout ?? layoutOf(t)
  const innerW = Math.max(5, t.widthMm - l.paddingMm * 2)
  // Grosor de barra para que el EAN-13 (≈ 95 módulos + bordes) entre en el ancho disponible
  const barW = Math.max(0.4, Math.min(2, (innerW * MM) / (l.barcodeNumber ? 113 : 97)))
  const price = currentPrice(p)
  const priceText = l.showCents ? money(price) : money(price).replace(/,00$/, '')
  const box: React.CSSProperties = {
    width: `${t.widthMm}mm`, height: `${t.heightMm}mm`, padding: `${l.paddingMm}mm`, boxSizing: 'border-box', overflow: 'hidden', background: '#fff', color: '#000',
    display: 'flex', flexDirection: 'column', justifyContent: 'safe center', alignItems: l.align === 'center' ? 'center' : 'flex-start', textAlign: l.align, gap: '0.3mm',
    border: l.border ? '0.2mm solid #000' : undefined, fontFamily: 'var(--font-inter), Arial, sans-serif', lineHeight: 1.05,
  }
  // flexShrink 0: si no entra, se recorta abajo en vez de encimarse (el editor avisa)
  const one: React.CSSProperties = { maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }
  const el = (f: LabelField) => {
    switch (f) {
      case 'logo': return <img key={f} src={l.logoUrl || LOGO} alt="" style={{ height: `${l.logoHeight ?? Math.max(3, Math.round(t.heightMm * 0.25))}mm`, maxWidth: '100%', objectFit: 'contain', flexShrink: 0, filter: l.logoBW ? 'grayscale(1) contrast(1.6)' : undefined }} />
      case 'store': return l.storeText ? <div key={f} style={{ ...one, fontSize: `${l.storeSize}pt`, fontWeight: 800, letterSpacing: '0.3mm' }}>{l.storeText}</div> : null
      case 'name': return <div key={f} style={{ maxWidth: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontSize: `${l.nameSize}pt`, fontWeight: 600, flexShrink: 0 }}>{p.name.split(' (')[0]}</div>
      case 'barcode': return <div key={f} style={{ maxWidth: '100%', lineHeight: 0, flexShrink: 0 }}><Barcode value={p.barcode} height={l.barcodeHeight * MM} width={barW} fontSize={Math.max(7, Math.round(innerW * MM / 14))} displayValue={l.barcodeNumber} /></div>
      case 'price': return <div key={f} style={{ ...one, fontSize: `${l.priceSize}pt`, fontWeight: l.priceBold ? 800 : 500 }}>{priceText}</div>
      case 'sku': return <div key={f} style={{ ...one, fontSize: `${l.skuSize}pt`, fontFamily: 'ui-monospace, monospace', color: '#333' }}>{p.sku}</div>
      case 'text': return l.customText ? <div key={f} style={{ ...one, fontSize: `${l.textSize}pt` }}>{l.customText}</div> : null
    }
  }
  return <div className="label-cell" style={box}>{l.order.map(el)}</div>
}
