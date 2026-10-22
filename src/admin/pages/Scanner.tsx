import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Keyboard, ShoppingCart, Pencil, Tag } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { PageHeader, Card, Hint, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { useKeyboardWedge, CameraScanner, Barcode } from '../components/Scanner'
import { money, pct } from '../../lib/format'
import type { Product } from '../../lib/types'

export function ScannerPage() {
  const products = useStore(s => s.products)
  const [cam, setCam] = useState(false)
  const [hist, setHist] = useState<{ code: string; p?: Product; at: string }[]>([])
  const onScan = useCallback((code: string) => { setHist(h => [{ code, p: products.find(p => p.barcode === code || p.sku === code), at: new Date().toLocaleTimeString('es-AR') }, ...h].slice(0, 20)) }, [products])
  useKeyboardWedge(onScan)
  const last = hist[0]
  return (
    <>
      <PageHeader title="Escáner" subtitle="Consultá cualquier producto al instante: precio, stock y margen. Funciona con lector USB/Bluetooth o con la cámara del celular.">
        <button className={btnPrimary} onClick={() => setCam(true)}><Camera size={16} /> Abrir cámara</button>
      </PageHeader>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2 text-sm text-stone-600 mb-3"><Keyboard size={16} /> Con lector físico: escaneá ahora, sin hacer click en nada.</div>
            <input className={input + ' font-mono'} placeholder="o escribí el código y Enter (probá 7790000000011)" onKeyDown={e => { if (e.key === 'Enter') { onScan((e.target as HTMLInputElement).value.trim()); (e.target as HTMLInputElement).value = '' } }} />
            <div className="mt-3 flex flex-wrap gap-1 text-xs">{products.slice(0, 5).map(p => <button key={p.id} className="px-2 py-1 bg-stone-100 rounded font-mono hover:bg-stone-200" onClick={() => onScan(p.barcode)}>{p.barcode}</button>)}</div>
          </Card>
          <Hint><b>Lector recomendado:</b> cualquier lector 1D/2D USB o Bluetooth de ~$25.000 a $60.000 (Netum, Inateck, Symcode). Se conectan como teclado, no necesitan driver ni app. Para el celular no hace falta comprar nada: la cámara lee EAN-13 directo desde el navegador.</Hint>
          <Card title="Últimas lecturas"><ul className="divide-y text-sm">{hist.map((h, i) => <li key={i} className="py-1.5 flex justify-between"><span className="font-mono">{h.code}</span><span className={h.p ? '' : 'text-red-600'}>{h.p?.name ?? 'no encontrado'}</span><span className="text-stone-400 text-xs">{h.at}</span></li>)}{hist.length === 0 && <li className="py-2 text-stone-400">Nada todavía.</li>}</ul></Card>
        </div>
        <Card>
          {!last ? <div className="text-center text-stone-400 py-16">Escaneá un producto para ver su ficha.</div> : !last.p ? <div className="text-center py-10"><div className="text-red-600 font-semibold">Código {last.code} no está en el sistema</div><Link to="/admin/productos/nuevo" className={btnPrimary + ' mt-4'}>Crear producto con este código</Link></div> : (
            <div>
              <img src={last.p.image} className="w-full aspect-square object-cover rounded-xl" alt="" />
              <h2 className="text-xl font-bold mt-4">{last.p.name}</h2>
              <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                <div className="bg-stone-50 rounded-lg p-3"><div className="text-xs text-stone-500">Precio</div><div className="font-bold text-lg">{money(last.p.price)}</div></div>
                <div className="bg-stone-50 rounded-lg p-3"><div className="text-xs text-stone-500">Stock</div><div className={`font-bold text-lg ${last.p.stock === 0 ? 'text-red-600' : ''}`}>{last.p.stock}</div></div>
                <div className="bg-stone-50 rounded-lg p-3"><div className="text-xs text-stone-500">Margen</div><div className="font-bold text-lg text-emerald-700">{pct((last.p.price - last.p.cost) / last.p.price)}</div></div>
              </div>
              <div className="flex justify-center mt-4"><Barcode value={last.p.barcode} /></div>
              <div className="flex gap-2 mt-4 flex-wrap"><Link to="/admin/pos" className={btnPrimary}><ShoppingCart size={14} /> Vender</Link><Link to={`/admin/productos/${last.p.id}`} className={btnGhost}><Pencil size={14} /> Editar</Link><Link to={`/admin/etiquetas?ids=${last.p.id}`} className={btnGhost}><Tag size={14} /> Imprimir etiqueta</Link></div>
            </div>
          )}
        </Card>
      </div>
      {cam && <CameraScanner onScan={onScan} onClose={() => setCam(false)} />}
    </>
  )
}
