import { X, Trash2, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { money } from '../../lib/format'

export function CartDrawer({ onClose }: { onClose: () => void }) {
  const { cart, products, updateCart } = useStore()
  const nav = useNavigate()
  const lines = cart.map(c => ({ ...c, p: products.find(p => p.id === c.productId)! })).filter(l => l.p)
  const subtotal = lines.reduce((a, l) => a + l.qty * (l.p.offerPrice ?? l.p.price), 0)
  return (
    <>
      <div className="sf-drawer-bg" onClick={onClose} />
      <aside className="sf-drawer">
        <button onClick={onClose} style={{ background: 'none', border: 0, cursor: 'pointer', alignSelf: 'flex-start' }}><X /></button>
        <h2>Mi carrito</h2>
        {lines.length === 0 && <p style={{ color: '#666' }}>Tu carrito está vacío.</p>}
        {lines.map(l => (
          <div className="sf-line" key={l.productId + l.variant}>
            <img src={l.p.image} alt="" />
            <div>
              <div className="n">{l.p.name}</div>
              {l.variant && <div className="v">{l.p.variants?.attr}: {l.variant}</div>}
              <div className="sf-qty" style={{ marginBottom: 0, marginTop: 8 }}>
                <button onClick={() => updateCart(l.productId, l.variant, l.qty - 1)}>−</button>
                <input value={l.qty} readOnly style={{ width: 36, height: 28 }} />
                <button onClick={() => updateCart(l.productId, l.variant, Math.min(l.p.stock, l.qty + 1))}>+</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>{money(l.qty * (l.p.offerPrice ?? l.p.price))}<Trash2 size={15} style={{ cursor: 'pointer' }} onClick={() => updateCart(l.productId, l.variant, 0)} /></div>
          </div>
        ))}
        {lines.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="sf-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="sf-row"><span>Calculá el costo de envío</span><ChevronDown size={16} /></div>
            <div className="sf-row"><span>¿Tenés un descuento?</span><ChevronDown size={16} /></div>
            <div className="sf-row total"><span>Total</span><span>{money(subtotal)}</span></div>
            <div style={{ marginTop: 30 }}>
              <button className="sf-btn lg" style={{ borderRadius: 30 }} onClick={() => { onClose(); nav('/checkout') }}>Iniciar compra</button>
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }} onClick={onClose}>Seguir comprando</div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
