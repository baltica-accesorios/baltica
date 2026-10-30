'use client'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, Package, Search, X } from 'lucide-react'
import type { Product } from '@/lib/types'
import { money } from '@/lib/format'
import { btnGhost, btnPrimary, input } from './AdminLayout'

export function ProductPicker({ products, selectedIds, category, categoryLabel, onChange }: {
  products: Product[]; selectedIds: string[]; category?: string; categoryLabel: string; onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = selectedIds.map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p)
  const unavailable = selectedIds.filter(id => !products.some(p => p.id === id && (!category || p.category === category)))
  return <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-medium">Productos incluidos</h3><p className="mt-1 text-xs text-stone-500">{selectedIds.length ? `${selectedIds.length} producto${selectedIds.length === 1 ? '' : 's'} seleccionado${selectedIds.length === 1 ? '' : 's'}` : category ? `Toda la categoría ${categoryLabel}` : 'Todos los productos de la tienda'}</p></div>
      <button type="button" className={btnGhost} onClick={() => setOpen(true)}><Package size={15} />{selectedIds.length ? 'Editar selección' : 'Elegir productos'}</button>
    </div>
    {selectedIds.length > 0 && <><div className="mt-3 flex flex-wrap gap-2">{selected.slice(0, 5).map(p => <div key={p.id} className="flex max-w-full items-center gap-2 rounded-lg border border-stone-200 bg-white py-1 pr-3 pl-1">{p.image ? <img src={p.image} alt="" className="h-7 w-7 rounded object-cover" /> : <Package size={18} className="m-1 text-stone-400" />}<span className="max-w-44 truncate text-xs">{p.name}</span></div>)}{selected.length > 5 && <span className="self-center text-xs text-stone-500">+{selected.length - 5} más</span>}</div><button type="button" className="mt-3 text-xs text-stone-600 underline underline-offset-2" onClick={() => onChange([])}>{category ? 'Aplicar a toda la categoría' : 'Aplicar a toda la tienda'}</button></>}
    {!!unavailable.length && <p role="alert" className="mt-3 text-xs text-amber-800">Hay {unavailable.length} producto(s) que no pertenecen a la categoría actual o ya no están disponibles. Editá la selección.</p>}
    {open && <SelectionModal products={products.filter(p => !category || p.category === category)} selectedIds={selectedIds} categoryLabel={categoryLabel} onClose={() => setOpen(false)} onApply={ids => { onChange(ids); setOpen(false) }} />}
  </div>
}

function SelectionModal({ products, selectedIds, categoryLabel, onClose, onApply }: {
  products: Product[]; selectedIds: string[]; categoryLabel: string; onClose: () => void; onApply: (ids: string[]) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId(), searchId = useId()
  const [query, setQuery] = useState('')
  const [onlySelected, setOnlySelected] = useState(false)
  const [chosen, setChosen] = useState(() => new Set(selectedIds.filter(id => products.some(p => p.id === id))))
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const results = useMemo(() => products.filter(p => (!onlySelected || chosen.has(p.id)) && normalize(`${p.name} ${p.sku} ${p.barcode}`).includes(normalize(query.trim()))), [products, chosen, onlySelected, query])
  useEffect(() => {
    const element = dialog.current!, previous = document.activeElement
    element.showModal()
    return () => { element.close(); if (previous instanceof HTMLElement) previous.focus() }
  }, [])
  const toggle = (id: string) => setChosen(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next })
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose() }} className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] rounded-2xl border border-stone-200 bg-white p-0 text-stone-900 shadow-xl backdrop:bg-stone-950/40">
    <div className="flex max-h-[90dvh] flex-col">
      <div className="border-b border-stone-100 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><h2 id={titleId} className="text-lg font-semibold">Elegir productos</h2><p className="mt-1 text-sm text-stone-500">{categoryLabel} · Marcá los productos que participan de la promoción.</p></div><button type="button" aria-label="Cerrar selector" onClick={onClose} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"><X size={18} /></button></div>
        <label htmlFor={searchId} className="sr-only">Buscar productos</label><div className="relative mt-5"><Search size={17} className="pointer-events-none absolute left-3 top-3 text-stone-400" /><input id={searchId} autoFocus type="search" className={input + ' pl-10'} placeholder="Buscar por nombre, SKU o código de barras" value={query} onChange={e => setQuery(e.target.value)} /></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"><button type="button" aria-pressed={onlySelected} className={'rounded-full px-3 py-1.5 ' + (onlySelected ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600')} onClick={() => setOnlySelected(v => !v)}>Ver seleccionados ({chosen.size})</button><button type="button" disabled={!results.length} className="text-stone-600 underline underline-offset-2 disabled:opacity-40" onClick={() => setChosen(previous => new Set([...previous, ...results.map(p => p.id)]))}>Seleccionar resultados ({results.length})</button></div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4" style={{ maxHeight: '45dvh' }}>
        {results.length ? <ul className="divide-y divide-stone-100">{results.map(p => <li key={p.id}><label className={'flex cursor-pointer items-center gap-3 rounded-lg p-3 transition hover:bg-stone-50 ' + (chosen.has(p.id) ? 'bg-stone-50' : '')}><input type="checkbox" className="h-4 w-4 shrink-0 accent-stone-900" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Seleccionar ${p.name}`} />{p.image ? <img src={p.image} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg bg-stone-100 object-cover" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-400"><Package size={22} /></div>}<div className="min-w-0 flex-1"><div className="text-sm font-medium leading-snug">{p.name}</div><div className="mt-1 text-xs text-stone-500">{p.sku || p.barcode}{p.active === false ? ' · Oculto en tienda' : ''}</div></div><div className="shrink-0 text-right"><div className="text-sm font-medium">{money(p.price)}</div><div className={'mt-1 text-xs ' + (p.stock ? 'text-stone-500' : 'text-amber-700')}>{p.stock ? `${p.stock} en stock` : 'Sin stock'}</div></div></label></li>)}</ul> : <div className="py-12 text-center"><Search size={24} className="mx-auto mb-3 text-stone-300" /><p className="text-sm text-stone-600">{onlySelected ? 'No hay productos seleccionados que coincidan.' : 'No encontramos productos.'}</p><p className="mt-1 text-xs text-stone-400">Probá otro nombre o código.</p></div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 p-4 sm:px-6"><div className="text-sm"><span className="font-medium" role="status">{chosen.size} seleccionados</span>{chosen.size > 0 && <button type="button" className="ml-3 text-xs text-stone-500 underline" onClick={() => setChosen(new Set())}>Limpiar</button>}</div><div className="flex gap-2"><button type="button" className={btnGhost} onClick={onClose}>Cancelar</button><button type="button" className={btnPrimary} disabled={!chosen.size} onClick={() => onApply([...chosen])}><Check size={16} />Aplicar selección</button></div></div>
    </div>
  </dialog>
}
