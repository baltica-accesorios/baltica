'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, Percent, Pencil, Trash2, Sparkles, ArrowLeft, Wand2 } from 'lucide-react'
import { useAdmin } from '../context'
import { quickUpdateProduct, saveSettings, bulkOffer, bulkPriceUpdate, deleteProduct, newBarcode, saveProduct } from '../actions'
import { productStockTotal, redistributionError } from '@/lib/variants'
import { ProductVariantsEditor } from '../components/ProductVariantsEditor'
import { offerActive, offerPct } from '@/lib/pricing'
import { NameModal, nameSlug } from '../components/NameModal'
import { ImageUpload } from '../components/ImageUpload'
import { PageHeader, Card, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { Barcode } from '../components/Scanner'
import { CATEGORIES, categoryName } from '@/data/categories'
import { money, moneyShort, pct, roundTo, uid } from '@/lib/format'
import type { Product } from '@/lib/types'

// Valor para <input type="datetime-local"> en la hora local
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

export function Products() {
  const { products, settings } = useAdmin()
  const [quick, setQuick] = useState<Product | null>(null)
  const [busy, setBusy] = useState(false)
  const [offer, setOffer] = useState('20')
  const [offerEnd, setOfferEnd] = useState(() => { const d = new Date(); d.setHours(23, 59, 0, 0); return toLocalInput(d) })
  const runOffer = async (pct: number) => { setBusy(true); const r = await bulkOffer(sel, pct, pct ? offerEnd || null : null); setBusy(false); if (!r.ok) { window.alert(r.error); return } setSel([]) }
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [sel, setSel] = useState<string[]>([]); const [bulk, setBulk] = useState('')
  const list = useMemo(() => products.filter(p => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()) || p.barcode.includes(q))), [products, q, cat])
  const toggle = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  return (
    <>
      {quick && <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-auto space-y-3"><h2 className="font-bold">Edición rápida · {quick.name}</h2><label className="block">Precio<input className={input} type="number" min="1" value={quick.price} onChange={e => setQuick({ ...quick, price: Number(e.target.value) })} /></label>{quick.variants?.options.length ? quick.variants.options.map(o => <label className="block" key={o}>Stock {o}<input className={input} type="number" min="0" value={quick.variantStock?.[o] ?? 0} onChange={e => setQuick({ ...quick, variantStock: { ...quick.variantStock, [o]: Number(e.target.value) } })} /></label>) : <label className="block">Stock<input className={input} type="number" min="0" value={quick.stock} onChange={e => setQuick({ ...quick, stock: Number(e.target.value) })} /></label>}<button className={btnPrimary} disabled={busy} onClick={async () => { setBusy(true); try { const r = await quickUpdateProduct(quick.id, quick.price, quick.stock, quick.variantStock); if (r.ok) setQuick(null); else window.alert(r.error) } finally { setBusy(false) } }}>Guardar</button><button className={btnGhost} onClick={() => setQuick(null)}>Cancelar</button></div></div>}
      <PageHeader title="Productos" subtitle={`${products.length} productos. Cada uno tiene su costo, precio, stock y código de barras.`}>
        <Link href="/admin/productos/nuevo" className={btnPrimary}><Plus size={16} /> Nuevo producto</Link>
      </PageHeader>
      <Card>
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <div className="relative flex-1 min-w-60"><Search size={16} className="absolute left-3 top-2.5 text-stone-400" /><input className={input + ' pl-9'} placeholder="Nombre, SKU o código de barras" value={q} onChange={e => setQ(e.target.value)} /></div>
          <select className={input + ' w-auto'} value={cat} onChange={e => setCat(e.target.value)}><option value="">Todas las categorías</option>{(settings.categories ?? CATEGORIES).map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
          {sel.length > 0 && <div className="w-full sm:w-auto flex flex-wrap items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-sm"><Percent size={14} /> {sel.length} seleccionados · aumentar <input className="w-16 border rounded px-1" placeholder="%" value={bulk} onChange={e => setBulk(e.target.value)} /> % <button className={btnPrimary + ' py-1'} disabled={busy || !Number(bulk)} onClick={async () => { if (!window.confirm(`¿Cambiar ${Number(bulk) > 0 ? '+' : ''}${bulk}% el precio de ${sel.length} productos?`)) return; setBusy(true); const r = await bulkPriceUpdate(sel, Number(bulk)); setBusy(false); if (!r.ok) { window.alert(r.error); return } setSel([]); setBulk('') }}>Aplicar</button></div>}
          {sel.length > 0 && <div className="w-full flex flex-wrap items-center gap-2 bg-stone-900 text-white rounded-lg px-3 py-2 text-sm">
            <span className="font-medium">Oferta para {sel.length}:</span>
            <span>−<input className="w-12 bg-white text-stone-900 rounded px-1 mx-1" value={offer} onChange={e => setOffer(e.target.value)} inputMode="numeric" aria-label="Porcentaje de descuento" />%</span>
            <span>hasta <input type="datetime-local" className="bg-white text-stone-900 rounded px-1" value={offerEnd} onChange={e => setOfferEnd(e.target.value)} aria-label="Fin de la oferta" /></span>
            <button className="bg-amber-400 text-black rounded-md px-3 py-1 font-semibold disabled:opacity-50" disabled={busy || !(Number(offer) > 0)} onClick={() => runOffer(Number(offer))}>Poner en oferta</button>
            <button className="underline text-stone-300 hover:text-white" disabled={busy} onClick={() => runOffer(0)}>Quitar oferta</button>
            <span className="text-xs text-stone-400 w-full">Vacío el &quot;hasta&quot; = sin fecha de fin. Al vencer, vuelve solo al precio normal.</span>
          </div>}
        </div>
        {/* Celular: tarjetas */}
        <div className="md:hidden">
          <label className="flex items-center gap-2 text-xs text-stone-500 pb-2 border-b"><input type="checkbox" onChange={e => setSel(e.target.checked ? list.map(p => p.id) : [])} /> Seleccionar todos ({list.length})</label>
          <ul className="divide-y">{list.map(p => (
            <li key={p.id} className="py-3 flex items-center gap-3">
              <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`Seleccionar ${p.name}`} />
              <Link href={`/admin/productos/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <img src={p.image} className="w-12 h-12 rounded object-cover shrink-0" alt="" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm leading-tight line-clamp-2">{p.name}{p.active === false && <span className="ml-1 text-[10px] bg-stone-200 text-stone-600 rounded-full px-1.5 py-0.5">oculto</span>}</div>
                  <div className="text-xs text-stone-500 mt-0.5 flex flex-wrap gap-x-2">
                    <span className="font-semibold text-stone-900">{moneyShort(offerActive(p) ? p.offerPrice! : p.price)}</span>
                    {offerActive(p) && <span className="text-amber-700 font-semibold">{offerPct(p)}% OFF</span>}
                    <span>costo {moneyShort(p.cost)}</span>
                    <span className="text-emerald-700">{pct((p.price - p.cost) / p.price)}</span>
                  </div>
                </div>
              </Link>
              <button className="text-xs underline" onClick={() => setQuick({ ...p })}>Editar precio/stock</button><span className={`px-2 py-0.5 rounded-full text-xs shrink-0 ${p.stock === 0 ? 'bg-red-100 text-red-700' : p.stock <= (p.minStock ?? settings.lowStockThreshold) ? 'bg-amber-100 text-amber-800' : 'bg-stone-100'}`}>{p.stock} u.</span>
            </li>
          ))}</ul>
        </div>
        <div className="overflow-auto hidden md:block">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2"><input type="checkbox" onChange={e => setSel(e.target.checked ? list.map(p => p.id) : [])} /></th><th className="pb-2">Producto</th><th className="pb-2">Categoría</th><th className="pb-2">SKU / Código</th><th className="pb-2 pl-3 text-right">Costo</th><th className="pb-2 pl-3 text-right">Precio</th><th className="pb-2 pl-3 text-right">Margen</th><th className="pb-2 pl-3 text-right">Stock</th><th /></tr></thead>
            <tbody className="divide-y">{list.map(p => (
              <tr key={p.id} className="hover:bg-stone-50">
                <td className="py-2"><input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} /></td>
                <td className="py-2"><Link href={`/admin/productos/${p.id}`} className="flex items-center gap-3"><img src={p.image} className="w-10 h-10 rounded object-cover" alt="" /><div><div>{p.name}{p.active === false && <span className="ml-2 text-[10px] bg-stone-200 text-stone-600 rounded-full px-1.5 py-0.5">oculto</span>}</div>{p.variants && <div className="text-xs text-stone-500">{p.variants.attr}: {p.variants.options.join(', ')}</div>}</div></Link></td>
                <td className="py-2 text-xs">{categoryName(p.category)}</td>
                <td className="py-2 font-mono text-xs">{p.sku}<div className="text-stone-400">{p.barcode}</div></td>
                <td className="py-2 text-right text-stone-500">{moneyShort(p.cost)}</td><td className="py-2 text-right font-medium">{offerActive(p) ? <><div>{moneyShort(p.offerPrice!)}</div><div className="text-[10px] text-stone-400 line-through">{moneyShort(p.price)}</div><div className="text-[10px] text-amber-700 font-semibold whitespace-nowrap">{offerPct(p)}% OFF{p.offerEndsAt ? ` · hasta ${new Date(p.offerEndsAt).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}</div></> : moneyShort(p.price)}</td>
                <td className="py-2 text-right"><span className={p.price - p.cost < p.cost * 0.5 ? 'text-amber-600' : 'text-emerald-700'}>{pct((p.price - p.cost) / p.price)}</span></td>
                <td className="py-2 text-right"><span className={`px-2 py-0.5 rounded-full text-xs ${p.stock === 0 ? 'bg-red-100 text-red-700' : p.stock <= (p.minStock ?? settings.lowStockThreshold) ? 'bg-amber-100 text-amber-800' : 'bg-stone-100'}`}>{p.stock}</span></td>
                <td className="py-2 text-right whitespace-nowrap"><button className="text-xs underline mr-3" onClick={() => setQuick({ ...p })}>Edición rápida</button><Link href={`/admin/productos/${p.id}`} className="text-stone-400 hover:text-stone-900 inline-block mr-2"><Pencil size={15} /></Link><button className="text-stone-400 hover:text-red-600" aria-label="Eliminar" onClick={() => { if (window.confirm(`¿Eliminar "${p.name}"? Deja de verse en la tienda; las ventas viejas no se tocan.`)) deleteProduct(p.id) }}><Trash2 size={15} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

export function ProductForm({ existing, initialBarcode }: { existing?: Product | null; initialBarcode: string }) {
  const nav = useRouter()
  const [creating, setCreating] = useState<'category' | 'subcategory' | 'material' | null>(null)
  const { settings, products } = useAdmin()
  const [redistributionTotal, setRedistributionTotal] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [p, setP] = useState<Product>(existing ?? { id: 'p' + uid(), slug: '', name: '', category: 'anillos', subcategory: null, material: 'acero quirúrgico', price: 0, cost: 0, stock: 0, minStock: 2, sku: '', barcode: initialBarcode, image: '', images: [], variants: null, createdAt: new Date().toISOString(), active: true })
  const set = (patch: Partial<Product>) => setP(x => ({ ...x, ...patch }))
  const opts = p.variants?.attr ? p.variants.options : []
  const markup = p.markupPct ?? settings.defaultMarkup
  const suggested = roundTo(p.cost * (1 + markup / 100), settings.roundTo)
  const margin = p.price ? (p.price - p.cost) / p.price : 0
  const cat = (settings.categories ?? CATEGORIES).find(c => c.slug === p.category)
  const allocationError = redistributionTotal === null ? '' : redistributionError(redistributionTotal, productStockTotal(p))
  const save = async () => {
    if (allocationError) { setErr(allocationError); return }
    setSaving(true); setErr('')
    const r = await saveProduct({ ...p, image: p.images?.[0] ?? p.image })
    setSaving(false)
    if (!r.ok) { setErr(r.error); return }
    nav.push('/admin/productos')
  }
  return (
    <>
      {creating && <NameModal
        title={creating === 'category' ? 'Nueva categoría' : creating === 'subcategory' ? 'Nueva subcategoría' : 'Nuevo material'}
        description={creating === 'subcategory' ? `Se agregará a ${cat?.name ?? p.category}.` : 'Se guardará y quedará seleccionada en este producto.'}
        placeholder={creating === 'category' ? 'Ej. Accesorios para el pelo' : creating === 'subcategory' ? 'Ej. Acero quirúrgico' : 'Ej. Plata 925'}
        existingNames={creating === 'category' ? (settings.categories ?? CATEGORIES).flatMap(c => [c.slug, c.name]) : creating === 'subcategory' ? (cat?.children ?? []).flatMap(c => [c.slug, c.name]) : [...(settings.materials ?? []), ...products.map(x => x.material)]}
        onClose={() => setCreating(null)}
        onCreate={async name => {
          const slug = nameSlug(name)
          if (creating === 'subcategory' && !cat) return 'Seleccioná una categoría antes de agregar la subcategoría.'
          const patch = creating === 'category' ? { categories: [...(settings.categories ?? CATEGORIES), { slug, name }] }
            : creating === 'subcategory' ? { categories: (settings.categories ?? CATEGORIES).map(c => c.slug === p.category ? { ...c, children: [...(c.children ?? []), { slug, name }] } : c) }
            : { materials: [...new Set([...(settings.materials ?? []), name])] }
          const r = await saveSettings(patch)
          if (!r.ok) return r.error
          if (creating === 'category') set({ category: slug, subcategory: null })
          else if (creating === 'subcategory') set({ subcategory: slug })
          else set({ material: name })
        }} />}
      <PageHeader title={existing ? 'Editar producto' : 'Nuevo producto'} subtitle="Los mismos campos que Empretienda, más costo, stock mínimo y código de barras."><Link href="/admin/productos" className={btnGhost}><ArrowLeft size={16} /> Volver</Link></PageHeader>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Datos del producto">
            <div className="grid md:grid-cols-2 gap-3">
              <label className="md:col-span-2 text-sm">Nombre<input className={input + ' mt-1'} value={p.name} onChange={e => set({ name: e.target.value })} placeholder="Anillo Alma (acero quirúrgico)" /></label>
              <label className="text-sm">Categoría<select className={input + ' mt-1'} value={p.category} onChange={e => set({ category: e.target.value, subcategory: null })}>{(settings.categories ?? CATEGORIES).map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select><button className="text-xs underline mt-1" onClick={() => setCreating('category')}>+ Nueva categoría</button></label>
              <label className="text-sm">Subcategoría<select className={input + ' mt-1'} value={p.subcategory ?? ''} onChange={e => set({ subcategory: e.target.value || null })}><option value="">—</option>{cat?.children?.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select><button className="text-xs underline mt-1" onClick={() => setCreating('subcategory')}>+ Nueva subcategoría</button></label>
              <label className="text-sm">Material<select className={input + ' mt-1'} value={p.material} onChange={e => set({ material: e.target.value })}>{[...new Set([...(settings.materials ?? []), ...products.map(x => x.material), p.material])].filter(Boolean).map(m => <option key={m}>{m}</option>)}</select><button className="text-xs underline mt-1" onClick={() => setCreating('material')}>+ Nuevo material</button></label>
              <label className="text-sm flex items-center gap-2 mt-6"><input type="checkbox" checked={p.active !== false} onChange={e => set({ active: e.target.checked })} /> Visible en la tienda</label>
              <div className="md:col-span-2 text-sm">Fotos<div className="mt-1"><ImageUpload images={p.images?.length ? p.images : p.image ? [p.image] : []} onChange={images => set({ images, image: images[0] ?? '' })} /></div></div>
              <label className="md:col-span-2 text-sm">Descripción<textarea className={input + ' mt-1'} rows={3} value={p.description ?? ''} onChange={e => set({ description: e.target.value })} /></label>
              <div className="md:col-span-2"><ProductVariantsEditor product={p} catalog={settings.attributes ?? []} redistributionTotal={redistributionTotal} onRedistribute={total => setRedistributionTotal(current => current ?? total)} onChange={set} /></div>
            </div>
          </Card>
          <Card title="Costo y precio">
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-x-3 gap-y-4">
              <label className="text-sm flex min-w-0 flex-col justify-between">Costo (lo que pagás)<input className={input + ' mt-1'} type="number" value={p.cost} onChange={e => set({ cost: Number(e.target.value) })} /></label>
              <label className="text-sm flex min-w-0 flex-col justify-between">% ganancia de este producto<input className={input + ' mt-1'} type="number" value={p.markupPct ?? settings.defaultMarkup} onChange={e => set({ markupPct: Number(e.target.value), price: roundTo(p.cost * (1 + Number(e.target.value) / 100), settings.roundTo) })} /></label>
              <label className="text-sm flex min-w-0 flex-col justify-between">Precio de venta<input className={input + ' mt-1'} type="number" value={p.price} onChange={e => set({ price: Number(e.target.value) })} /></label>
              <label className="text-sm flex min-w-0 flex-col justify-between">Precio oferta (opcional)<input className={input + ' mt-1'} type="number" value={p.offerPrice ?? ''} onChange={e => set({ offerPrice: e.target.value ? Number(e.target.value) : null })} /></label>
              <label className="text-sm flex min-w-0 flex-col justify-between">Precio mayorista (opcional)<input className={input + ' mt-1'} type="number" value={p.wholesalePrice ?? ''} onChange={e => set({ wholesalePrice: e.target.value ? Number(e.target.value) : null })} placeholder="lo ven sólo los mayoristas" /></label>
              {!!p.offerPrice && <label className="text-sm flex min-w-0 flex-col justify-between sm:col-span-2">La oferta termina (vacío = sin fecha)<input className={input + ' mt-1'} type="datetime-local" value={p.offerEndsAt ? toLocalInput(new Date(p.offerEndsAt)) : ''} onChange={e => set({ offerEndsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <button className={btnGhost + ' text-xs'} onClick={() => set({ price: suggested })}><Wand2 size={14} /> Recalcular precio: {money(suggested)} (costo + {markup}%)</button>
              <span className={`text-xs ${margin < 0.35 ? 'text-amber-600' : 'text-emerald-700'}`}>Margen: {pct(margin)} · ganás {money(p.price - p.cost)} por unidad</span>
            </div>
          </Card>
          <Card title="Stock e identificación">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Stock</div>
                {opts.length ? <><p className="text-sm">Stock por combinación: <b>{opts.reduce((sum, key) => sum + (p.variantStock?.[key] ?? 0), 0)} unidades</b></p><p className="text-xs text-stone-500 mt-1">Editá las cantidades en la tabla de atributos y variantes.</p></> : <label className="text-sm block">Unidades en stock<input className={input.replace('w-full ', '') + ' mt-1 w-32'} type="number" min={0} inputMode="numeric" value={p.stock} onChange={e => set({ stock: Number(e.target.value) })} /></label>}
                <div className="mt-4 rounded-lg bg-stone-50 border px-3 py-2.5">
                  <div className="text-sm font-medium">Aviso de stock bajo</div>
                  <label className="text-sm flex items-center gap-2 mt-1">Cuando queden
                    <input className={input.replace('w-full ', '') + ' w-16 text-center px-1 bg-white'} type="number" min={0} inputMode="numeric" value={p.minStock ?? 0} onChange={e => set({ minStock: Number(e.target.value) })} aria-label="Stock mínimo" />
                    o menos</label>
                  <p className="text-xs text-stone-500 mt-1">Aparece en las alertas de Stock y en el inicio del panel para que sepas qué reponer.</p>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Identificación</div>
                <label className="text-sm block">SKU (código interno)<input className={input + ' mt-1'} value={p.sku} onChange={e => set({ sku: e.target.value })} placeholder="Se genera solo si lo dejás vacío" /></label>
                <label className="text-sm block mt-3">Código de barras<div className="flex gap-1 mt-1"><input className={input + ' font-mono'} value={p.barcode} onChange={e => set({ barcode: e.target.value })} inputMode="numeric" /><button className={btnGhost + ' px-3 shrink-0'} title="Generar un código nuevo" onClick={async () => set({ barcode: await newBarcode() })}><Sparkles size={14} /> Nuevo</button></div></label>
                <p className="text-xs text-stone-500 mt-1">Si el producto ya trae código del proveedor, escanealo acá y se usa ese. Si no, el sistema genera uno propio y lo imprimís desde Etiquetas.</p>
              </div>
            </div>
          </Card>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2"><button className={btnPrimary} onClick={save} disabled={!p.name || !p.price || saving || !!allocationError}>{saving ? 'Guardando…' : 'Guardar producto'}</button><Link href="/admin/productos" className={btnGhost}>Cancelar</Link></div>
        </div>
        <div className="space-y-4">
          <Card title="Así se ve en la tienda">
            <div className="sf"><div className="sf-card">{p.image ? <img src={p.image} alt="" /> : <div className="aspect-square bg-stone-100 rounded" />}<h3>{p.name || 'Nombre del producto'}</h3><p className="price">{p.offerPrice ? <><del>{money(p.price)}</del>{money(p.offerPrice)}</> : money(p.price)}</p></div></div>
          </Card>
          <Card title="Etiqueta"><div className="flex justify-center py-2"><Barcode value={p.barcode} /></div><div className="text-center text-xs text-stone-500">{p.sku || 'SKU auto'} · {money(p.price)}</div></Card>
        </div>
      </div>
    </>
  )
}
