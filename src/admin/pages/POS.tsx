import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Search, Trash2, Check, Banknote, Landmark, CreditCard, QrCode, Percent, UserRound, Printer, RotateCcw, ShoppingBag } from 'lucide-react'
import { useStore, findProduct } from '../../store/useStore'
import { useKeyboardWedge, CameraScanner } from '../components/Scanner'
import { PageHeader, Card, Hint, btnPrimary, btnGhost, input } from '../components/AdminLayout'
import { money, moneyShort } from '../../lib/format'
import type { PaymentMethod, SaleItem, Sale } from '../../lib/types'

interface Line extends SaleItem { image: string; stock: number }
const PAY: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote }, { id: 'transferencia', label: 'Transferencia', icon: Landmark },
  { id: 'debito', label: 'Débito', icon: CreditCard }, { id: 'credito', label: 'Crédito', icon: CreditCard }, { id: 'qr', label: 'QR / MP', icon: QrCode },
]

export function POS() {
  const { products, registerSale, settings } = useStore()
  const [lines, setLines] = useState<Line[]>([])
  const [q, setQ] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('efectivo')
  const [discount, setDiscount] = useState(0)
  const [seller, setSeller] = useState(settings.sellers[0])
  const [customer, setCustomer] = useState('')
  const [cam, setCam] = useState(false)
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null)
  const [done, setDone] = useState<Sale | null>(null)
  const [cash, setCash] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const linesRef = useRef<Line[]>([]); linesRef.current = lines
  const addProduct = useCallback((id: string, variant?: string) => {
    const p = products.find(p => p.id === id); if (!p) return
    const ls = linesRef.current
    const i = ls.findIndex(l => l.productId === id && l.variant === variant)
    const inCart = i >= 0 ? ls[i].qty : 0
    if (inCart + 1 > p.stock) { setFlash({ ok: false, msg: `Sin stock de "${p.name}" (quedan ${p.stock})` }); return }
    setFlash({ ok: true, msg: `+1 ${p.name}` })
    if (i >= 0) { const c = [...ls]; c[i] = { ...c[i], qty: c[i].qty + 1 }; setLines(c) }
    else setLines([...ls, { productId: p.id, name: p.name, qty: 1, unitPrice: p.offerPrice ?? p.price, unitCost: p.cost, variant, image: p.image, stock: p.stock }])
    setQ('')
  }, [products])

  const onScan = useCallback((code: string) => {
    const p = products.find(p => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase())
    if (p) addProduct(p.id, p.variants?.options[0])
    else setFlash({ ok: false, msg: `Código ${code} no encontrado. Podés crearlo desde Productos.` })
  }, [products, addProduct])
  useKeyboardWedge(onScan, !done)

  useEffect(() => { if (flash) { const t = setTimeout(() => setFlash(null), 2200); return () => clearTimeout(t) } }, [flash])
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 300); return () => clearTimeout(t) }, [done])

  const results = useMemo(() => findProduct(products, q), [products, q])
  const subtotal = lines.reduce((a, l) => a + l.qty * l.unitPrice, 0)
  const discountAmt = Math.round(subtotal * discount / 100)
  const total = subtotal - discountAmt
  const profit = lines.reduce((a, l) => a + l.qty * (l.unitPrice - l.unitCost), 0) - discountAmt
  const change = cash ? Number(cash) - total : 0

  const confirm = () => {
    const sale = registerSale(lines.map(({ image: _i, stock: _s, ...rest }) => rest), { channel: 'local', payment, discount: discountAmt, seller, customer: customer ? { name: customer } : undefined })
    setDone(sale); setLines([]); setDiscount(0); setCustomer(''); setCash('')
  }

  if (done) return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4"><Check size={32} /></div>
      <h1 className="text-2xl font-bold">Venta #{done.number} registrada</h1>
      <p className="text-stone-500 mt-1">{money(done.total)} · {done.payment} · {done.seller}</p>
      <p className="text-sm text-stone-500 mt-4">El stock ya se descontó en la tienda online y en el local.</p>
      <div className="flex gap-2 justify-center mt-8">
        <button className={btnGhost} onClick={() => window.print()}><Printer size={16} /> Imprimir ticket</button>
        <button className={btnPrimary} onClick={() => setDone(null)}><RotateCcw size={16} /> Nueva venta</button>
      </div>
      <div className="print-area hidden print:block text-left font-mono text-xs mt-8 w-72 mx-auto">
        <div className="text-center font-bold">BÁLTICA ACCESORIOS</div><div className="text-center">San Nicolás de los Arroyos</div><div className="text-center">Venta #{done.number} · {new Date(done.createdAt).toLocaleString('es-AR')}</div><hr className="my-2" />
        {done.items.map((i, k) => <div key={k} className="flex justify-between"><span>{i.qty} x {i.name}{i.variant ? ` (${i.variant})` : ''}</span><span>{moneyShort(i.qty * i.unitPrice)}</span></div>)}
        {done.discount > 0 && <div className="flex justify-between"><span>Descuento</span><span>-{moneyShort(done.discount)}</span></div>}
        <hr className="my-2" /><div className="flex justify-between font-bold"><span>TOTAL</span><span>{money(done.total)}</span></div><div>Pago: {done.payment}</div><div className="text-center mt-3">¡Gracias por tu compra! ♥</div>
      </div>
    </div>
  )

  return (
    <>
      <PageHeader title="Vender en mostrador" subtitle="Escaneá el código con el lector o la cámara, o buscá por nombre. La venta descuenta stock al instante, el mismo stock que ve la tienda online.">
        <button className={btnGhost} onClick={() => setCam(true)}><Camera size={16} /> Escanear con cámara</button>
      </PageHeader>
      {flash && <div className={`fixed top-4 right-4 z-40 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${flash.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>{flash.msg}</div>}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-3 text-stone-400" />
              <input ref={inputRef} className={input + ' pl-10 py-3 text-base'} placeholder="Escaneá un código o escribí el nombre / SKU..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && results[0]) addProduct(results[0].id, results[0].variants?.options[0]) }} />
            </div>
            {q && (
              <ul className="mt-2 divide-y max-h-80 overflow-auto">
                {results.map(p => (
                  <li key={p.id} className="py-2 flex items-center gap-3 hover:bg-stone-50 cursor-pointer rounded px-1" onClick={() => addProduct(p.id, p.variants?.options[0])}>
                    <img src={p.image} className="w-10 h-10 rounded object-cover" alt="" /><div className="flex-1 min-w-0"><div className="text-sm truncate">{p.name}</div><div className="text-xs text-stone-500 font-mono">{p.sku} · {p.barcode}</div></div>
                    <div className="text-right"><div className="font-semibold text-sm">{moneyShort(p.offerPrice ?? p.price)}</div><div className={`text-xs ${p.stock <= 0 ? 'text-red-600' : 'text-stone-500'}`}>stock {p.stock}</div></div>
                  </li>
                ))}
                {results.length === 0 && <li className="py-3 text-sm text-stone-500">Nada con "{q}".</li>}
              </ul>
            )}
            {!q && <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500"><span>Accesos rápidos:</span>{products.slice(0, 6).map(p => <button key={p.id} onClick={() => addProduct(p.id, p.variants?.options[0])} className="px-2 py-1 bg-stone-100 rounded hover:bg-stone-200">{p.name.split(' (')[0]}</button>)}</div>}
          </Card>
          <Card>
            {lines.length === 0 ? <div className="text-center py-10 text-stone-400"><ShoppingBag size={40} className="mx-auto mb-2 text-stone-300" />Todavía no agregaste productos.<div className="text-xs mt-1">Probá escanear o escribir "anillo".</div></div> : (
              <table className="w-full text-sm">
                <thead className="text-xs text-stone-500 uppercase"><tr><th className="text-left pb-2">Producto</th><th className="pb-2">Cant.</th><th className="text-right pb-2">Precio</th><th className="text-right pb-2">Total</th><th /></tr></thead>
                <tbody className="divide-y">{lines.map((l, i) => (
                  <tr key={i}>
                    <td className="py-2"><div className="flex items-center gap-3"><img src={l.image} className="w-10 h-10 rounded object-cover" alt="" /><div><div>{l.name}</div>{l.variant && <select className="text-xs text-stone-500 bg-transparent" value={l.variant} onChange={e => setLines(ls => ls.map((x, k) => k === i ? { ...x, variant: e.target.value } : x))}>{products.find(p => p.id === l.productId)?.variants?.options.map(o => <option key={o}>{o}</option>)}</select>}</div></div></td>
                    <td className="py-2 text-center"><div className="inline-flex items-center border rounded-lg"><button className="px-2 py-1" onClick={() => setLines(ls => ls.map((x, k) => k === i ? { ...x, qty: x.qty - 1 } : x).filter(x => x.qty > 0))}>−</button><span className="px-2 font-medium">{l.qty}</span><button className="px-2 py-1" disabled={l.qty >= l.stock} onClick={() => setLines(ls => ls.map((x, k) => k === i ? { ...x, qty: Math.min(x.stock, x.qty + 1) } : x))}>+</button></div></td>
                    <td className="py-2 text-right"><input className="w-24 text-right border rounded px-2 py-1" value={l.unitPrice} onChange={e => setLines(ls => ls.map((x, k) => k === i ? { ...x, unitPrice: Number(e.target.value) || 0 } : x))} /></td>
                    <td className="py-2 text-right font-medium">{moneyShort(l.qty * l.unitPrice)}</td>
                    <td className="py-2 text-right"><button onClick={() => setLines(ls => ls.filter((_, k) => k !== i))} className="text-stone-400 hover:text-red-600"><Trash2 size={16} /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Card>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="text-xs uppercase text-stone-500 mb-2">Medio de pago</div>
            <div className="grid grid-cols-3 gap-2">{PAY.map(p => <button key={p.id} onClick={() => setPayment(p.id)} className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs ${payment === p.id ? 'bg-stone-900 text-white border-stone-900' : 'hover:bg-stone-50'}`}><p.icon size={18} />{p.label}</button>)}</div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <label className="text-xs text-stone-500"><span className="flex items-center gap-1 mb-1"><Percent size={12} /> Descuento %</span><input className={input} type="number" min={0} max={100} value={discount} onChange={e => setDiscount(Number(e.target.value))} /></label>
              <label className="text-xs text-stone-500"><span className="flex items-center gap-1 mb-1"><UserRound size={12} /> Vendedor/a</span><select className={input} value={seller} onChange={e => setSeller(e.target.value)}>{settings.sellers.map(s => <option key={s}>{s}</option>)}</select></label>
            </div>
            <label className="text-xs text-stone-500 block mt-3">Cliente (opcional)<input className={input + ' mt-1'} placeholder="Nombre o teléfono" value={customer} onChange={e => setCustomer(e.target.value)} /></label>
            {payment === 'efectivo' && <label className="text-xs text-stone-500 block mt-3">Paga con<input className={input + ' mt-1'} type="number" placeholder="Monto recibido" value={cash} onChange={e => setCash(e.target.value)} />{cash && change >= 0 && <span className="text-emerald-700 font-medium">Vuelto: {money(change)}</span>}</label>}
          </Card>
          <Card>
            <div className="flex justify-between text-sm py-1"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {discountAmt > 0 && <div className="flex justify-between text-sm py-1 text-red-600"><span>Descuento {discount}%</span><span>-{money(discountAmt)}</span></div>}
            <div className="flex justify-between text-2xl font-bold py-2 border-t mt-1"><span>Total</span><span>{money(total)}</span></div>
            <div className="text-xs text-stone-500 flex justify-between"><span>Ganancia estimada</span><span className="text-emerald-700 font-medium">{money(profit)}</span></div>
            <button className={btnPrimary + ' w-full justify-center py-3 text-base mt-4'} disabled={lines.length === 0} onClick={confirm}><Check size={18} /> Cobrar {money(total)}</button>
            <button className="w-full text-xs text-stone-400 mt-2 hover:text-red-600" onClick={() => setLines([])}>Vaciar</button>
          </Card>
          <Hint>Si una venta online entra mientras cobrás, el sistema avisa antes de confirmar si el stock ya no alcanza. En producción esto lo garantiza una transacción en la base de datos (ver docs de arquitectura).</Hint>
        </div>
      </div>
      {cam && <CameraScanner onScan={onScan} onClose={() => setCam(false)} />}
    </>
  )
}
