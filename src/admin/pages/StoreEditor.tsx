'use client'
import { useState } from 'react'
import { useAdmin } from '../context'
import { saveSettings } from '../actions'
import { NameModal, nameSlug } from '../components/NameModal'
import { ImageUpload } from '../components/ImageUpload'
import { Card, PageHeader, btnGhost, btnPrimary, input } from '../components/AdminLayout'
import { CATEGORIES, LOGO } from '@/data/categories'
import type { Settings } from '@/lib/types'

export function StoreEditor() {
  const { settings } = useAdmin()
  const [draft, setDraft] = useState(settings)
  const [creating, setCreating] = useState<{ parent?: string } | null>(null)
  const [tab, setTab] = useState('Inicio')
  const [mobile, setMobile] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<Settings>) => setDraft(s => ({ ...s, ...patch }))
  const categories = draft.categories ?? CATEGORIES
  const banners = draft.banners ?? []
  const changeCategory = (index: number, patch: Partial<(typeof categories)[number]>) => set({ categories: categories.map((c, i) => i === index ? { ...c, ...patch } : c) })
  const moveCategory = (index: number, delta: number) => { const next = [...categories]; const target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; set({ categories: next }) }
  const parent = categories.find(c => c.slug === creating?.parent)
  return <>
    {creating && <NameModal title={creating.parent ? 'Nueva subcategoría' : 'Nueva categoría'}
      description={parent ? `Se agregará a ${parent.name}. Guardá el diseño para aplicar los cambios.` : 'Guardá el diseño para mostrar la nueva categoría en la tienda.'}
      placeholder={creating.parent ? 'Ej. Acero quirúrgico' : 'Ej. Accesorios para el pelo'}
      existingNames={(creating.parent ? parent?.children ?? [] : categories).flatMap(c => [c.slug, c.name])}
      onClose={() => setCreating(null)} onCreate={name => {
        const category = { slug: nameSlug(name), name }
        if (creating.parent) {
          if (!parent) return 'La categoría ya no está disponible.'
          changeCategory(categories.indexOf(parent), { children: [...(parent.children ?? []), category] })
        } else set({ categories: [...categories, category] })
      }} />}
    <PageHeader title="Diseño de la tienda" subtitle="Editá las secciones, revisá la vista previa y guardá para aplicar los cambios.">
      <a href="/" target="_blank" rel="noreferrer" className={btnGhost}>Ver tienda</a>
      <button className={btnPrimary} disabled={busy} onClick={async () => { setBusy(true); try { const r = await saveSettings({ banners: draft.banners, categories: draft.categories, announcement: draft.announcement, homeTitle: draft.homeTitle, storeName: draft.storeName, mobileCategoryColumns: draft.mobileCategoryColumns, desktopCategoryColumns: draft.desktopCategoryColumns }); setMessage(r.ok ? 'Diseño guardado en la tienda' : r.error) } catch { setMessage('No se pudo guardar. Intentá nuevamente.') } finally { setBusy(false) } }}>Guardar cambios</button>
    </PageHeader>
    {message && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm">{message}</p>}
    <div className="grid xl:grid-cols-[420px_1fr] gap-5 items-start">
      <div className="space-y-4"><div className="flex gap-2">{['Inicio', 'Banners', 'Categorías'].map(t => <button key={t} className={tab === t ? btnPrimary : btnGhost} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Inicio' && <Card title="Secciones de inicio"><div className="grid grid-cols-2 gap-2 mb-4">{(['mobileCategoryColumns', 'desktopCategoryColumns'] as const).map(field => <label className="text-sm" key={field}>{field === 'mobileCategoryColumns' ? 'Categorías por fila · celular' : 'Categorías por fila · escritorio'}<select className={input} value={draft[field] ?? (field === 'mobileCategoryColumns' ? 2 : 3)} onChange={e => set({ [field]: Number(e.target.value) })}>{(field === 'mobileCategoryColumns' ? [1, 2, 3] : [1, 2, 3, 4]).map(n => <option key={n} value={n}>{n}</option>)}</select></label>)}</div><label className="block text-sm mb-4">Nombre de la tienda<input className={input} value={draft.storeName} onChange={e => set({ storeName: e.target.value })} /></label><label className="block text-sm mb-4">Barra de anuncio superior<textarea className={input} value={draft.announcement} placeholder="Envíos a todo el país · Nueva colección" onChange={e => set({ announcement: e.target.value })} /><span className="text-xs text-stone-500">Dejala vacía para ocultarla.</span></label><label className="block text-sm">Título del listado de productos<input className={input} value={draft.homeTitle ?? 'Ingresos'} onChange={e => set({ homeTitle: e.target.value })} /></label></Card>}
      {tab === 'Banners' && <Card title="Banners del inicio"><div className="space-y-5">{banners.map((b, i) => <div key={i} className="border rounded-lg p-3 space-y-2"><ImageUpload images={b.image ? [b.image] : []} onChange={images => set({ banners: banners.map((x, k) => k === i ? { ...x, image: images.at(-1) ?? '' } : x) })} /><label className="block text-xs">Texto alternativo<input className={input} value={b.alt} onChange={e => set({ banners: banners.map((x, k) => k === i ? { ...x, alt: e.target.value } : x) })} /></label><label className="block text-xs">Enlace al tocar el banner<input className={input} value={b.href} placeholder="/productos" onChange={e => set({ banners: banners.map((x, k) => k === i ? { ...x, href: e.target.value } : x) })} /></label><button className="text-sm underline mr-3" disabled={i === 0} onClick={() => { const next = [...banners]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; set({ banners: next }) }}>Subir</button><button className="text-sm text-red-700 underline" onClick={() => set({ banners: banners.filter((_, k) => k !== i) })}>Quitar banner</button></div>)}</div><button className={btnGhost + ' mt-4'} onClick={() => set({ banners: [...banners, { image: '', href: '/productos', alt: draft.storeName }] })}>+ Agregar banner</button></Card>}
      {tab === 'Categorías' && <Card title="Categorías y navegación"><p className="text-xs text-stone-500 mb-3">Las categorías con foto aparecen en el inicio. El orden también se aplica al menú.</p><div className="space-y-4">{categories.map((c, i) => <details key={c.slug} className="border rounded-lg p-3"><summary className="cursor-pointer font-medium text-sm">{c.name}</summary><div className="space-y-3 mt-3"><label className="block text-xs">Nombre<input className={input} value={c.name} onChange={e => changeCategory(i, { name: e.target.value })} /></label><p className="text-xs text-stone-500">Dirección: /{c.slug}</p><label className="block text-xs">Título de la imagen de inicio<input className={input} value={c.tileTitle ?? c.name} onChange={e => changeCategory(i, { tileTitle: e.target.value })} /></label><label className="block text-xs">Enlace de la imagen de inicio<input className={input} value={c.href ?? '/' + c.slug} onChange={e => changeCategory(i, { href: e.target.value })} /></label><ImageUpload images={c.image ? [c.image] : []} onChange={images => changeCategory(i, { image: images.at(-1) ?? '' })} />{(c.children ?? []).map((child, k) => <div key={child.slug} className="flex gap-2"><input aria-label="Nombre de subcategoría" className={input} value={child.name} onChange={e => changeCategory(i, { children: c.children!.map((x, j) => j === k ? { ...x, name: e.target.value } : x) })} /><button onClick={() => changeCategory(i, { children: c.children!.filter((_, j) => j !== k) })}>Quitar</button></div>)}<button className="text-xs underline" onClick={() => setCreating({ parent: c.slug })}>+ Subcategoría</button><div className="flex gap-3 text-xs"><button disabled={i === 0} onClick={() => moveCategory(i, -1)}>↑ Subir</button><button disabled={i === categories.length - 1} onClick={() => moveCategory(i, 1)}>↓ Bajar</button><button className="text-red-700" onClick={() => set({ categories: categories.filter((_, k) => k !== i) })}>Quitar categoría</button></div></div></details>)}</div><button className={btnGhost + ' mt-4'} onClick={() => setCreating({})}>+ Agregar categoría</button></Card>}
      </div>
      <div className="sticky top-4"><div className="flex justify-between items-center mb-3"><span className="text-sm text-stone-500">Vista previa del diseño</span><button className={btnGhost} onClick={() => setMobile(!mobile)}>{mobile ? 'Ver escritorio' : 'Ver celular'}</button></div><div className="mx-auto bg-white border rounded-2xl overflow-hidden shadow-sm transition-all" style={{ maxWidth: mobile ? 375 : '100%', height: '75vh', overflowY: 'auto' }}>{draft.announcement && <div className="bg-stone-900 text-white text-center text-xs p-2">{draft.announcement}</div>}<div className="border-b p-4 flex justify-between items-center"><img src={LOGO} alt={draft.storeName} className="h-9" /><span className="text-xs">☰　⌕　♡</span></div>{banners[0]?.image && <img src={banners[0].image} alt={banners[0].alt} className="w-full" />}<div className="grid gap-3 p-4" style={{ gridTemplateColumns: `repeat(${mobile ? draft.mobileCategoryColumns ?? 2 : draft.desktopCategoryColumns ?? 3}, minmax(0, 1fr))` }}>{categories.filter(c => c.image).map(c => <div key={c.slug} className="relative"><img src={c.image} className="aspect-square object-cover w-full" alt={c.name} /><span className="absolute bottom-0 inset-x-0 bg-white/85 text-center text-xs p-2">{c.tileTitle || c.name}</span></div>)}</div><h3 className="text-center text-lg p-5">{draft.homeTitle || 'Ingresos'}</h3></div></div>
    </div>
  </>
}
