'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { X, Plus } from 'lucide-react'
import { btnGhost, btnPrimary, input } from './AdminLayout'

export const nameSlug = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function NameModal({ title, description, placeholder, existingNames, onCreate, onClose }: {
  title: string
  description: string
  placeholder: string
  existingNames: string[]
  onCreate: (name: string) => Promise<string | void> | string | void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const titleId = useId(), descriptionId = useId(), inputId = useId(), errorId = useId()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current!
    const previousFocus = document.activeElement
    element.showModal()
    return () => { element.close(); if (previousFocus instanceof HTMLElement) previousFocus.focus() }
  }, [])
  const close = () => { if (!submitting.current) onClose() }
  return <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={e => { e.preventDefault(); close() }}
    onClick={e => { if (e.target === e.currentTarget) { const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) close() } }}
    className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[90dvh] overflow-auto rounded-2xl border border-stone-200 bg-white p-0 text-stone-900 shadow-xl backdrop:bg-stone-950/40">
    <form className="p-6" aria-busy={busy} onSubmit={async e => {
      e.preventDefault()
      if (submitting.current) return
      const value = name.trim(), slug = nameSlug(value)
      if (!slug) { setError('Ingresá un nombre con letras o números.'); return }
      if (existingNames.some(n => nameSlug(n) === slug)) { setError('Ya existe una opción con ese nombre.'); return }
      submitting.current = true; setBusy(true); setError('')
      try {
        const message = await onCreate(value)
        if (message) setError(message)
        else onClose()
      } catch { setError('No se pudo guardar. Intentá nuevamente.') }
      finally { submitting.current = false; setBusy(false) }
    }}>
      <div className="flex items-start justify-between gap-4">
        <div className="mb-5"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100"><Plus size={20} /></div><h2 id={titleId} className="text-lg font-semibold">{title}</h2><p id={descriptionId} className="mt-1 text-sm text-stone-500">{description}</p></div>
        <button type="button" aria-label="Cerrar" disabled={busy} onClick={close} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-40"><X size={18} /></button>
      </div>
      <label htmlFor={inputId} className="text-sm font-medium">Nombre</label>
      <input id={inputId} autoFocus required maxLength={100} disabled={busy} className={input + ' mt-2'} placeholder={placeholder} value={name} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} onChange={e => { setName(e.target.value); setError('') }} />
      {error && <p id={errorId} role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" className={btnGhost} disabled={busy} onClick={close}>Cancelar</button><button type="submit" className={btnPrimary} disabled={busy || !name.trim()}>{busy ? 'Guardando…' : 'Agregar'}</button></div>
    </form>
  </dialog>
}
