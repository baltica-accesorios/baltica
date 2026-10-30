'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, X } from 'lucide-react'
import type { AttributeDefinition } from '@/lib/types'
import { attributeKey } from '@/lib/variants'
import { input, btnGhost, btnPrimary } from './AdminLayout'

export function AttributeEditorModal({ initial, onClose, onSave }: { initial?: AttributeDefinition; onClose: () => void; onSave: (attribute: AttributeDefinition) => Promise<string | void> }) {
  const dialog = useRef<HTMLDialogElement>(null), submitting = useRef(false)
  const titleId = useId()
  const [draft, setDraft] = useState<AttributeDefinition>(() => initial ?? { id: crypto.randomUUID(), name: '', type: 'text', values: [] })
  const [newValue, setNewValue] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { const el = dialog.current!, focus = document.activeElement; el.showModal(); return () => { el.close(); if (focus instanceof HTMLElement) focus.focus() } }, [])
  const close = () => { if (!submitting.current) onClose() }
  const add = () => {
    const label = newValue.trim()
    if (!label) return
    if (draft.values.some(v => attributeKey(v.label) === attributeKey(label))) { setError('Esa opción ya existe.'); return }
    if (label.includes(' / ')) { setError('No uses / como separador dentro de una opción.'); return }
    setDraft({ ...draft, values: [...draft.values, { label, ...(draft.type === 'color' ? { color: '#808080' } : {}) }] }); setNewValue(''); setError('')
  }
  return createPortal(<dialog ref={dialog} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); close() }} className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 text-stone-900 shadow-xl backdrop:bg-stone-950/40">
    <form onSubmit={async e => { e.preventDefault(); e.stopPropagation(); if (submitting.current) return; if (newValue.trim()) { setError('Agregá la opción escrita antes de guardar.'); return } if (!draft.values.length) { setError('Agregá al menos una opción.'); return } submitting.current = true; setBusy(true); setError(''); try { const err = await onSave(draft); if (err) setError(err); else onClose() } catch { setError('No pudimos guardar el atributo. Intentá nuevamente.') } finally { submitting.current = false; setBusy(false) } }}>
      <div className="flex items-start justify-between gap-3 mb-5"><div><h2 id={titleId} className="text-lg font-semibold">{initial ? 'Editar atributo' : 'Nuevo atributo'}</h2><p className="text-sm text-stone-500 mt-1">Crealo una vez y usalo en distintos productos.</p></div><button type="button" aria-label="Cerrar" disabled={busy} onClick={close}><X size={20} /></button></div>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm">Nombre del atributo<input autoFocus required maxLength={80} className={input + ' mt-1'} placeholder="Color, Tamaño, Diseño…" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label className="block text-sm">Cómo se muestra<select className={input + ' mt-1'} value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as AttributeDefinition['type'], values: draft.values.map(v => ({ ...v, ...(e.target.value === 'color' ? { color: v.color || '#808080' } : {}) })) })}><option value="text">Opciones de texto (talles, tamaños, diseños)</option><option value="color">Muestras de color</option></select></label>
        <div><p className="text-sm font-medium mb-2">Opciones</p><div className="space-y-2">{draft.values.map((v, i) => <div key={i} className="flex items-center gap-2 rounded-lg border border-stone-200 p-2">{draft.type === 'color' && <input type="color" aria-label={`Color de ${v.label}`} value={v.color ?? '#808080'} onChange={e => setDraft({ ...draft, values: draft.values.map((x, k) => k === i ? { ...x, color: e.target.value } : x) })} className="h-9 w-10 shrink-0 cursor-pointer rounded" />}<input className={input} aria-label={`Nombre de opción ${i + 1}`} required maxLength={80} value={v.label} onChange={e => setDraft({ ...draft, values: draft.values.map((x, k) => k === i ? { ...x, label: e.target.value } : x) })} /><button type="button" aria-label={`Quitar ${v.label}`} className="p-2 text-stone-500 hover:text-red-600" onClick={() => setDraft({ ...draft, values: draft.values.filter((_, k) => k !== i) })}><Trash2 size={16} /></button></div>)}</div>
          <div className="flex gap-2 mt-3"><input aria-label="Nueva opción" maxLength={80} className={input} placeholder={draft.type === 'color' ? 'Ej. Rojo' : 'Ej. Mediano'} value={newValue} onChange={e => setNewValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} /><button type="button" className={btnGhost} disabled={!newValue.trim() || draft.values.length >= 100} onClick={add}><Plus size={16} />Agregar</button></div>
        </div>
        <p className="text-xs text-stone-500">El stock, el precio y las fotos se asignan en cada producto. Los nombres y opciones que ya están en uso se conservan para mantener sus variantes.</p>
      </fieldset>
      {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" className={btnGhost} disabled={busy} onClick={close}>Cancelar</button><button type="submit" className={btnPrimary} disabled={busy || !draft.name.trim() || !draft.values.length}>{busy ? 'Guardando…' : 'Guardar atributo'}</button></div>
    </form>
  </dialog>, document.body)
}
