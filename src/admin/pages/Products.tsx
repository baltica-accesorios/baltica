import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Search, Percent, Pencil, Trash2, Sparkles, ArrowLeft, Wand2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { PageHeader, Card, Hint, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { Barcode } from '../components/Scanner'
import { CATEGORIES, categoryName } from '../../data/categories'
import { money, moneyShort, pct, roundTo, uid } from '../../lib/format'
import type { Product } from '../../lib/types'

export function Products() {
  const { products, bulkPriceUpdate, deleteProduct, settings } = useStore()
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [sel, setSel] = useState<string[]>([]); const [bulk, setBulk] = useState('')
  const list = useMemo(() => products.filter(p => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()) || p.barcode.includes(q))), [products, q, cat])
  const toggle = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  return (
    <>
      <PageHeader title="Productos" subtitle={`${products.length} productos. Cada uno tiene su costo, precio, stock y código de barras.`}>
        <Link to="/admin/productos/nuevo" className={btnPrimary}><Plus size={16} /> Nuevo producto</Link>
      </PageHeader>
      <Card>
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <div className="relative flex-1 min-w-60"><Search size={16} className="absolute left-3 top-2.5 text-stone-400" /><input className={input + ' pl-9'} placeholder="Nombre, SKU o código de barras" value={q} onChange={e => setQ(e.target.value)} /></div>
          <select className={input + ' w-auto'} value={cat} onChange={e => setCat(e.target.value)}><option value="">Todas las categorías</option>{CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
          {sel.length > 0 && <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-sm"><Percent size={14} /> {sel.length} seleccionados · aumentar <input className="w-16 border rounded px-1" placeholder="%" value={bulk} onChange={e => setBulk(e.target.value)} /> % <button className={btnPrimary + ' py-1'} onClick={() => { bulkPriceUpdate(sel, Number(bulk)); setSel([]); setBulk('') }}>Aplicar</button></div>}
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2"><input type="checkbox" onChange={e => setSel(e.target.checked ? list.map(p => p.id) : [])} /></th><th className="pb-2">Producto</th><th className="pb-2">Categoría</th><th className="pb-2">SKU / Código</th><th className="pb-2 text-right">Costo</th><th className="pb-2 text-right">Precio</th><th className="pb-2 text-right">Margen</th><th className="pb-2 text-right">Stock</th><th /></tr></thead>
            <tbody className="divide-y">{list.map(p => (
              <tr key={p.id} className="hover:bg-stone-50">
                <td className="py-2"><input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} /></td>
                <td className="py-2"><Link to={`/admin/productos/${p.id}`} className="flex items-center gap-3"><img src={p.image} className="w-10 h-10 rounded object-cover" alt="" /><div><div>{p.name}</div>{p.variants && <div className="text-xs text-stone-500">{p.variants.attr}: {p.variants.options.join(', ')}</div>}</div></Link></td>
                <td className="py-2 text-xs">{categoryName(p.category)}</td>
                <td className="py-2 font-mono text-xs">{p.sku}<div className="text-stone-400">{p.barcode}</div></td>
                <td className="py-2 text-right text-stone-500">{moneyShort(p.cost)}</td><td className="py-2 text-right font-medium">{moneyShort(p.price)}</td>
                <td className="py-2 text-right"><span className={p.price - p.cost < p.cost * 0.5 ? 'text-amber-600' : 'text-emerald-700'}>{pct((p.price - p.cost) / p.price)}</span></td>
                <td className="py-2 text-right"><span className={`px-2 py-0.5 rounded-full text-xs ${p.stock === 0 ? 'bg-red-100 text-red-700' : p.stock <= (p.minStock ?? settings.lowStockThreshold) ? 'bg-amber-100 text-amber-800' : 'bg-stone-100'}`}>{p.stock}</span></td>
                <td className="py-2 text-right whitespace-nowrap"><Link to={`/admin/productos/${p.id}`} className="text-stone-400 hover:text-stone-900 inline-block mr-2"><Pencil size={15} /></Link><button className="text-stone-400 hover:text-red-600" onClick={() => { if (window.confirm(`¿Eliminar "${p.name}"?`)) deleteProduct(p.id) }}><Trash2 size={15} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

export function ProductForm() {
  const { id } = useParams(); const nav = useNavigate()
  const { products, upsertProduct, settings, newBarcode } = useStore()
  const existing = products.find(p => p.id === id)
  const [p, setP] = useState<Product>(existing ?? { id: 'p' + uid(), slug: '', name: '', category: 'anillos', subcategory: null, material: 'acero quirúrgico', price: 0, cost: 0, stock: 0, minStock: 2, sku: '', barcode: newBarcode(), image: 'https://d22fxaf9t8d39k.cloudfront.net/0635a9be0461c18f682aa387ba6dc4b2fed6660b2427268cd51ef02f543754d4225104.jpg', variants: null, createdAt: new Date().toISOString().slice(0, 10), active: true })
  const set = (patch: Partial<Product>) => setP(x => ({ ...x, ...patch }))
  const suggested = roundTo(p.cost * (1 + settings.defaultMarkup / 100), settings.roundTo)
  const margin = p.price ? (p.price - p.cost) / p.price : 0
  const cat = CATEGORIES.find(c => c.slug === p.category)
  const save = () => {
    const slug = p.slug || p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const sku = p.sku || `BA-${p.category.slice(0, 3).toUpperCase()}-${String(products.length + 1).padStart(3, '0')}`
    upsertProduct({ ...p, slug, sku, images: [p.image] }); nav('/admin/productos')
  }
  return (
    <>
      <PageHeader title={existing ? 'Editar producto' : 'Nuevo producto'} subtitle="Los mismos campos que Empretienda, más costo, stock mínimo y código de barras."><Link to="/admin/productos" className={btnGhost}><ArrowLeft size={16} /> Volver</Link></PageHeader>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Datos del producto">
            <div className="grid md:grid-cols-2 gap-3">
              <label className="md:col-span-2 text-sm">Nombre<input className={input + ' mt-1'} value={p.name} onChange={e => set({ name: e.target.value })} placeholder="Anillo Alma (acero quirúrgico)" /></label>
              <label className="text-sm">Categoría<select className={input + ' mt-1'} value={p.category} onChange={e => set({ category: e.target.value, subcategory: null })}>{CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
              <label className="text-sm">Subcategoría<select className={input + ' mt-1'} value={p.subcategory ?? ''} onChange={e => set({ subcategory: e.target.value || null })}><option value="">—</option>{cat?.children?.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></label>
              <label className="text-sm">Material<select className={input + ' mt-1'} value={p.material} onChange={e => set({ material: e.target.value })}>{['plata', 'acero quirúrgico', 'acero blanco', 'acero dorado', 'otro'].map(m => <option key={m}>{m}</option>)}</select></label>
              <label className="text-sm">Imagen (URL)<input className={input + ' mt-1'} value={p.image} onChange={e => set({ image: e.target.value })} /></label>
              <label className="md:col-span-2 text-sm">Descripción<textarea className={input + ' mt-1'} rows={3} value={p.description ?? ''} onChange={e => set({ description: e.target.value })} /></label>
              <label className="md:col-span-2 text-sm">Variantes (atributo y opciones separadas por coma)<div className="flex gap-2 mt-1"><input className={input} placeholder="Diámetro interno" value={p.variants?.attr ?? ''} onChange={e => set({ variants: { attr: e.target.value, options: p.variants?.options ?? [] } })} /><input className={input} placeholder="1.6cm, 1.7cm, 1.8cm" value={p.variants?.options.join(', ') ?? ''} onChange={e => set({ variants: { attr: p.variants?.attr ?? '', options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })} /></div></label>
            </div>
          </Card>
          <Card title="Costo y precio">
            <div className="grid md:grid-cols-3 gap-3">
              <label className="text-sm">Costo (lo que pagás)<input className={input + ' mt-1'} type="number" value={p.cost} onChange={e => set({ cost: Number(e.target.value) })} /></label>
              <label className="text-sm">Precio de venta<input className={input + ' mt-1'} type="number" value={p.price} onChange={e => set({ price: Number(e.target.value) })} /></label>
              <label className="text-sm">Precio oferta (opcional)<input className={input + ' mt-1'} type="number" value={p.offerPrice ?? ''} onChange={e => set({ offerPrice: e.target.value ? Number(e.target.value) : null })} /></label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <button className={btnGhost + ' text-xs'} onClick={() => set({ price: suggested })}><Wand2 size={14} /> Sugerir precio: {money(suggested)} (costo + {settings.defaultMarkup}%)</button>
              <span className={`text-xs ${margin < 0.35 ? 'text-amber-600' : 'text-emerald-700'}`}>Margen: {pct(margin)} · ganás {money(p.price - p.cost)} por unidad</span>
            </div>
          </Card>
          <Card title="Stock e identificación">
            <div className="grid md:grid-cols-4 gap-3">
              <label className="text-sm">Stock actual<input className={input + ' mt-1'} type="number" value={p.stock} onChange={e => set({ stock: Number(e.target.value) })} /></label>
              <label className="text-sm">Stock mínimo (alerta)<input className={input + ' mt-1'} type="number" value={p.minStock ?? 0} onChange={e => set({ minStock: Number(e.target.value) })} /></label>
              <label className="text-sm">SKU<input className={input + ' mt-1'} value={p.sku} onChange={e => set({ sku: e.target.value })} placeholder="auto" /></label>
              <label className="text-sm">Código de barras<div className="flex gap-1 mt-1"><input className={input + ' font-mono'} value={p.barcode} onChange={e => set({ barcode: e.target.value })} /><button className={btnGhost + ' px-2'} title="Generar EAN-13 nuevo" onClick={() => set({ barcode: newBarcode() })}><Sparkles size={14} /></button></div></label>
            </div>
            <Hint>Si el producto ya trae código de barras del proveedor, escanealo acá y se usa ese. Si no, el sistema genera uno propio (prefijo 779 = Argentina) y lo imprimís desde Etiquetas.</Hint>
          </Card>
          <div className="flex gap-2"><button className={btnPrimary} onClick={save} disabled={!p.name || !p.price}>Guardar producto</button><Link to="/admin/productos" className={btnGhost}>Cancelar</Link></div>
        </div>
        <div className="space-y-4">
          <Card title="Así se ve en la tienda">
            <div className="sf" style={{ fontFamily: 'Lato' }}><div className="sf-card"><img src={p.image} alt="" /><h3>{p.name || 'Nombre del producto'}</h3><p className="price">{p.offerPrice ? <><del>{money(p.price)}</del>{money(p.offerPrice)}</> : money(p.price)}</p></div></div>
          </Card>
          <Card title="Etiqueta"><div className="flex justify-center py-2"><Barcode value={p.barcode} /></div><div className="text-center text-xs text-stone-500">{p.sku || 'SKU auto'} · {money(p.price)}</div></Card>
        </div>
      </div>
    </>
  )
}
