'use client'
import Link from 'next/link'
import { X, Trash2 } from 'lucide-react'
import { useCart } from '../cart'
import { money } from '@/lib/format'

export function CartDrawer({ onClose }: { onClose: () => void }) {
  const { lines, update } = useCart()
  const subtotal = lines.reduce((a, l) => a + l.qty * l.price, 0)
  return (
    <>
      <div className="sf-drawer-bg" onClick={onClose} />
      <aside className="sf-drawer" role="dialog" aria-label="Mi carrito">
        <button aria-label="Cerrar carrito" onClick={onClose} style={{ background: 'none', border: 0, cursor: 'pointer', alignSelf: 'flex-start' }}><X /></button>
        <h2>Mi carrito</h2>
        {lines.length === 0 && <p style={{ color: '#666' }}>Tu carrito está vacío.</p>}
        {lines.map(l => (
          <div className="sf-line" key={l.productId + l.variant}>
            <img src={l.image} alt="" />
            <div>
              <div className="n">{l.name}</div>
              {l.variant && <div className="v">{l.attr}: {l.variant}</div>}
              <div className="sf-qty" style={{ marginBottom: 0, marginTop: 8 }}>
                <button aria-label="Quitar uno" onClick={() => update(l.productId, l.variant, l.qty - 1)}>−</button>
                <input value={l.qty} readOnly style={{ width: 36, height: 28 }} aria-label="Cantidad" />
                <button aria-label="Agregar uno" onClick={() => update(l.productId, l.variant, Math.min(l.stock, l.qty + 1))}>+</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>{money(l.qty * l.price)}<button aria-label="Eliminar" onClick={() => update(l.productId, l.variant, 0)} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}><Trash2 size={15} /></button></div>
          </div>
        ))}
        {lines.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="sf-row total"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <p style={{ fontSize: 13, color: '#666', margin: '6px 0 0' }}>El envío se elige en el siguiente paso.</p>
            <div style={{ marginTop: 30 }}>
              <Link href="/checkout" className="sf-btn lg" style={{ borderRadius: 30, display: 'flex', justifyContent: 'center' }} onClick={onClose}>Iniciar compra</Link>
              <button style={{ display: 'block', width: '100%', background: 'none', border: 0, textAlign: 'center', marginTop: 14, fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }} onClick={onClose}>Seguir comprando</button>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
