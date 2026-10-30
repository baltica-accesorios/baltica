'use client'
import { useState } from 'react'
import { Palette, Plus, Pencil, Trash2 } from 'lucide-react'
import { useAdmin } from '../context'
import { deleteAttribute, saveAttribute } from '../actions'
import { PageHeader, Card, btnPrimary, btnGhost } from '../components/AdminLayout'
import { AttributeEditorModal } from '../components/AttributeEditorModal'
import { attributeKey, attributesOf } from '@/lib/variants'
import type { AttributeDefinition } from '@/lib/types'

export function Attributes() {
  const { settings, products } = useAdmin()
  const [editing, setEditing] = useState<AttributeDefinition | 'new' | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const definitions = settings.attributes ?? []
  return <><PageHeader title="Atributos y características" subtitle="Definí colores, tamaños, talles y otras opciones para reutilizarlos en tus productos."><button className={btnPrimary} onClick={() => setEditing('new')}><Plus size={16} />Nuevo atributo</button></PageHeader>
    <p className="mb-5 text-sm text-stone-500">Por ejemplo: Color → Rojo, Azul. Al asignarlo a un producto, cada combinación tendrá su stock, precio e imágenes. Las opciones disponibles aparecerán como filtros en la tienda.</p>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {definitions.length ? <div className="grid gap-4 lg:grid-cols-2">{definitions.map(d => {
      const count = products.filter(p => attributesOf(p.variants).some(a => a.catalogId === d.id || attributeKey(a.attr) === attributeKey(d.name))).length
      return <Card key={d.id}><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{d.name}</h2><p className="mt-1 text-xs text-stone-500">{d.type === 'color' ? 'Muestras de color' : 'Opciones de texto'} · {count} productos</p></div><div className="flex gap-2"><button className={btnGhost + ' px-3'} aria-label={`Editar ${d.name}`} onClick={() => setEditing(d)}><Pencil size={15} /></button><button className={btnGhost + ' px-3'} disabled={busy || count > 0} title={count ? 'El atributo está asignado a productos' : 'Eliminar atributo sin uso'} aria-label={`Eliminar ${d.name}`} onClick={async () => { setBusy(true); try { const r = await deleteAttribute(d.id); if (!r.ok) setError(r.error) } catch { setError('No se pudo eliminar el atributo.') } finally { setBusy(false) } }}><Trash2 size={15} /></button></div></div><div className="flex flex-wrap gap-2 mt-4">{d.values.map(v => <span key={v.label} className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1.5 text-sm">{d.type === 'color' && <i className="h-4 w-4 rounded-full border border-black/15" style={{ background: v.color }} />}{v.label}</span>)}</div></Card>
    })}</div> : <Card><div className="text-center py-12"><Palette className="mx-auto mb-4 text-stone-400" size={32} /><h2 className="font-semibold">Creá tu primer atributo</h2><p className="text-sm text-stone-500 mt-2 mb-5">Color, Tamaño o Diseño: elegí las características que usan tus accesorios.</p><button className={btnPrimary} onClick={() => setEditing('new')}>Crear atributo</button></div></Card>}
    {editing && <AttributeEditorModal initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSave={async d => { const r = await saveAttribute(d); if (!r.ok) return r.error }} />}
  </>
}
