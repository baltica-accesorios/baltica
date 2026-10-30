'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ImagePlus, Plus, X } from 'lucide-react'
import type { AttributeDefinition, Product, ProductAttribute } from '@/lib/types'
import { productStockTotal, redistributionError, variantStructureChanged, attributesOf, attributeKey, buildVariants, decorateAttributes, valuesForVariant } from '@/lib/variants'
import { saveAttribute } from '../actions'
import { AttributeEditorModal } from './AttributeEditorModal'
import { btnGhost, btnPrimary, input } from './AdminLayout'

export function ProductVariantsEditor({ product: p, catalog, onChange, redistributionTotal, onRedistribute }: { product: Product; catalog: AttributeDefinition[]; redistributionTotal: number | null; onRedistribute: (total: number) => void; onChange: (patch: Partial<Product>) => void }) {
  const attrs = attributesOf(decorateAttributes(p, catalog).variants)
  const [creating, setCreating] = useState(false), [error, setError] = useState('')
  const [pending, setPending] = useState<ProductAttribute[] | null>(null)
  const [photoKey, setPhotoKey] = useState<string | null>(null)
  const apply = (next: ProductAttribute[]) => {
    try {
      const variants = buildVariants(next, p.variants)
      const total = redistributionTotal ?? productStockTotal(p)
      if (variantStructureChanged(p.variants, variants) && total > 0) onRedistribute(total)
      const stock = Object.fromEntries((variants?.options ?? []).map(key => [key, p.variantStock?.[key] ?? 0]))
      onChange({ variants, variantStock: variants ? stock : null, stock: total })
      setError(''); setPending(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Revisá los atributos') }
  }
  const change = (next: ProductAttribute[]) => {
    try {
      const options = buildVariants(next, p.variants)?.options ?? []
      const losesStock = p.variants ? p.variants.options.some(key => (p.variantStock?.[key] ?? 0) > 0 && !options.includes(key)) : p.stock > 0 && options.length > 0
      if (losesStock) { setPending(next); return }
      apply(next)
    } catch (e) { setError(e instanceof Error ? e.message : 'Revisá los atributos') }
  }
  const addDefinition = (d: AttributeDefinition) => change([...attrs, { attr: d.name, catalogId: d.id, type: d.type, options: d.values.map(v => v.label), colors: Object.fromEntries(d.values.filter(v => v.color).map(v => [v.label, v.color!])) }])
  const updateDetail = (key: string, detail: Partial<NonNullable<NonNullable<Product['variants']>['details']>[string]>) => onChange({ variants: { ...p.variants!, details: { ...p.variants?.details, [key]: { ...p.variants?.details?.[key], ...detail } } } })
  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Atributos y variantes</h3><p className="mt-1 text-xs text-stone-500">Elegí colores, tamaños u otras características y completá cada combinación.</p></div><Link className="text-xs underline" href="/admin/atributos" target="_blank">Administrar atributos</Link></div>
    <div className="flex flex-wrap gap-2"><select aria-label="Agregar atributo existente" className={input + ' flex-1 min-w-48'} value="" disabled={attrs.length >= 5} onChange={e => { const d = catalog.find(d => d.id === e.target.value); if (d) addDefinition(d) }}><option value="">Elegir atributo existente…</option>{catalog.filter(d => !attrs.some(a => a.catalogId === d.id || attributeKey(a.attr) === attributeKey(d.name))).map(d => <option key={d.id} value={d.id}>{d.name} ({d.values.length} opciones)</option>)}</select><button type="button" disabled={attrs.length >= 5} className={btnGhost} onClick={() => setCreating(true)}><Plus size={15} />Nuevo atributo</button></div>
    {attrs.map((a, index) => {
      const definition = catalog.find(d => d.id === a.catalogId || attributeKey(d.name) === attributeKey(a.attr))
      const options = [...new Set([...a.options, ...(definition?.values.map(v => v.label) ?? [])])]
      return <div key={a.attr} className="rounded-lg border border-stone-200 p-3"><div className="mb-3 flex justify-between items-center"><h4 className="text-sm font-medium">{a.attr}</h4><button type="button" className="text-xs text-stone-500 underline" onClick={() => change(attrs.filter((_, i) => i !== index))}>Quitar atributo</button></div><div className="flex flex-wrap gap-2">{options.map(option => <label key={option} className={'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm ' + (a.options.includes(option) ? 'border-stone-800 bg-stone-50' : 'border-stone-200')}><input type="checkbox" className="accent-stone-900" checked={a.options.includes(option)} onChange={e => { const selected = e.target.checked ? [...a.options, option] : a.options.filter(v => v !== option); if (!selected.length) { setError('Cada atributo necesita al menos una opción. Para quitarlo, usá “Quitar atributo”.'); return } change(attrs.map((x, i) => i === index ? { ...x, options: selected } : x)) }} />{a.type === 'color' && <i className="h-4 w-4 rounded-full border border-black/15" style={{ background: a.colors?.[option] }} />}{option}</label>)}</div></div>
    })}
    {redistributionTotal !== null && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold">Stock original: {redistributionTotal} unidades · Asignadas: {productStockTotal(p)}</p><p className="mt-1">{redistributionError(redistributionTotal, productStockTotal(p)) || 'Todas las unidades están asignadas. Ya podés guardar.'}</p><p className="mt-1 text-xs">El stock guardado se conserva hasta completar la distribución y guardar el producto.</p></div>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {!!p.variants?.options.length && <div className="overflow-x-auto rounded-lg border border-stone-200"><table className="w-full text-sm"><thead className="bg-stone-50 text-left text-xs text-stone-500"><tr><th className="p-3">Combinación</th><th className="p-3">Stock</th><th className="p-3">Precio</th><th className="p-3">Fotos</th></tr></thead><tbody className="divide-y divide-stone-100">{p.variants.options.map(key => {
      const detail = p.variants?.details?.[key], image = detail?.images?.[0] || detail?.image
      return <tr key={key}><td className="p-3 min-w-32 font-medium">{key}</td><td className="p-3"><input aria-label={`Stock de ${key}`} type="number" min={0} step={1} className={input + ' min-w-20'} value={p.variantStock?.[key] ?? 0} onChange={e => onChange({ variantStock: { ...p.variantStock, [key]: Number(e.target.value) } })} /></td><td className="p-3"><input aria-label={`Precio de ${key}`} type="number" min={1} step={1} className={input + ' min-w-28'} placeholder={String(p.price)} value={detail?.price ?? ''} onChange={e => updateDetail(key, { price: e.target.value ? Number(e.target.value) : undefined })} /></td><td className="p-3"><button type="button" aria-label={`Fotos de ${key}`} onClick={() => setPhotoKey(key)} className="flex items-center gap-2 rounded-lg border border-stone-200 p-1.5 text-xs">{image ? <img src={image} alt="" className="h-9 w-9 rounded object-cover" /> : <ImagePlus size={22} className="m-2 text-stone-400" />}<span className="pr-2">{detail?.images?.length || (image ? 1 : 'Elegir')}</span></button></td></tr>
    })}</tbody></table><p className="border-t p-3 text-xs text-stone-500">Total: {p.variants.options.reduce((sum, key) => sum + (p.variantStock?.[key] ?? 0), 0)} unidades. Sin precio propio se usa el precio del producto. Las opciones con stock 0 quedan deshabilitadas en la tienda.</p></div>}
    {creating && <AttributeEditorModal onClose={() => setCreating(false)} onSave={async d => { if (attrs.some(a => attributeKey(a.attr) === attributeKey(d.name))) return 'Este producto ya tiene ese atributo.'; const r = await saveAttribute(d); if (!r.ok) return r.error; addDefinition(d) }} />}
    {pending && <VariantChangeModal onClose={() => setPending(null)} onConfirm={() => apply(pending)} />}
    {photoKey && <VariantPhotos key={photoKey} product={p} variantKey={photoKey} onClose={() => setPhotoKey(null)} onSave={(images, sameColor) => {
      const details = { ...p.variants?.details }
      const colorIndex = attrs.findIndex(a => a.type === 'color' || attributeKey(a.attr) === 'color')
      const color = colorIndex >= 0 ? valuesForVariant(p.variants!, photoKey)[colorIndex] : undefined
      for (const key of p.variants!.options) if (key === photoKey || (sameColor && colorIndex >= 0 && valuesForVariant(p.variants!, key)[colorIndex] === color)) details[key] = { ...details[key], images, image: images[0] ?? '' }
      onChange({ variants: { ...p.variants!, details } }); setPhotoKey(null)
    }} />}
  </section>
}
function VariantChangeModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current!.showModal() }, [])
  return <dialog ref={ref} aria-label="Cambiar combinaciones" onCancel={e => { e.preventDefault(); onClose() }} className="m-auto max-w-md w-[calc(100%-2rem)] rounded-xl bg-white p-6 backdrop:bg-black/40"><h3 className="font-semibold mb-2">Revisar stock al cambiar variantes</h3><p className="text-sm text-stone-600">Tu stock total se conserva. Asigná las unidades pendientes a las nuevas combinaciones; no vas a poder guardar hasta que el total coincida con el original. Las combinaciones que se mantienen conservan sus cantidades.</p><div className="mt-5 flex justify-end gap-2"><button type="button" className={btnGhost} onClick={onClose}>Cancelar</button><button type="button" className={btnPrimary} onClick={onConfirm}>Cambiar combinaciones</button></div></dialog>
}
function VariantPhotos({ product, variantKey, onClose, onSave }: { product: Product; variantKey: string; onClose: () => void; onSave: (images: string[], sameColor: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null), detail = product.variants?.details?.[variantKey]
  const [selected, setSelected] = useState(detail?.images ?? (detail?.image ? [detail.image] : [])), [sameColor, setSameColor] = useState(false)
  const images = [...new Set([...(product.images ?? []), product.image, ...selected].filter(Boolean))]
  useEffect(() => { const previous = document.activeElement; ref.current!.showModal(); return () => { if (previous instanceof HTMLElement) previous.focus() } }, [])
  return <dialog ref={ref} aria-label={`Elegir fotos de ${variantKey}`} onCancel={e => { e.preventDefault(); onClose() }} className="m-auto max-w-xl w-[calc(100%-2rem)] max-h-[90dvh] overflow-auto rounded-xl bg-white p-6 backdrop:bg-black/40"><div className="flex justify-between gap-3"><div><h3 className="font-semibold">Fotos de {variantKey}</h3><p className="mt-1 text-xs text-stone-500">La primera que elijas será la principal. Podés elegir varias.</p></div><button type="button" aria-label="Cerrar fotos" onClick={onClose}><X size={20} /></button></div>{images.length ? <div className="grid grid-cols-3 gap-3 my-5">{images.map(src => <button key={src} type="button" aria-label={`Foto ${images.indexOf(src) + 1}`} aria-pressed={selected.includes(src)} className={'relative overflow-hidden rounded-lg border-2 ' + (selected.includes(src) ? 'border-stone-900' : 'border-transparent')} onClick={() => setSelected(selected.includes(src) ? selected.filter(x => x !== src) : [...selected, src])}><img src={src} alt="" className="aspect-square w-full object-cover" />{selected.includes(src) && <span className="absolute top-1 right-1 rounded-full bg-stone-900 text-white text-xs px-2 py-1">{selected.indexOf(src) + 1}</span>}</button>)}</div> : <p className="py-8 text-sm text-stone-500">Primero agregá fotos al producto.</p>}{attributesOf(product.variants).some(a => a.type === 'color' || attributeKey(a.attr) === 'color') && <label className="flex gap-2 text-sm"><input type="checkbox" checked={sameColor} onChange={e => setSameColor(e.target.checked)} />Usar estas fotos en todas las combinaciones de este color</label>}<div className="mt-5 flex justify-end gap-2"><button type="button" className={btnGhost} onClick={onClose}>Cancelar</button><button type="button" className={btnPrimary} onClick={() => onSave(selected, sameColor)}>Guardar fotos</button></div></dialog>
}
