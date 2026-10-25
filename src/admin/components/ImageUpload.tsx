'use client'
import { useState } from 'react'
import { ImagePlus, X, Star } from 'lucide-react'
import { uploadImage } from '../actions'

/** Achica la foto en el navegador (máx. 1400 px, WebP) antes de subirla: carga rápido en la tienda y ocupa poco. */
export async function shrink(file: File, max = 1400, type = 'image/webp'): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('No se pudo procesar la imagen')), type, 0.9))
}

export function ImageUpload({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true); setErr('')
    const out = [...images]
    for (const f of Array.from(files)) {
      try {
        const fd = new FormData()
        fd.set('file', new File([await shrink(f)], 'foto.webp', { type: 'image/webp' }))
        const r = await uploadImage(fd)
        if (r.ok) out.push(r.url); else setErr(r.error)
      } catch { setErr('No se pudo subir una de las fotos') }
    }
    onChange(out); setBusy(false)
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <div key={src + i} className={`relative w-20 h-20 rounded-lg overflow-hidden border ${i === 0 ? 'ring-2 ring-amber-400' : ''}`}>
            <img src={src} alt="" className="w-full h-full object-cover" />
            <button type="button" aria-label="Quitar foto" onClick={() => onChange(images.filter((_, k) => k !== i))} className="absolute top-0.5 right-0.5 bg-white/90 rounded-full p-0.5"><X size={12} /></button>
            {i > 0 && <button type="button" title="Usar como principal" onClick={() => onChange([src, ...images.filter((_, k) => k !== i)])} className="absolute bottom-0.5 right-0.5 bg-white/90 rounded-full p-0.5"><Star size={12} /></button>}
          </div>
        ))}
        <label className="w-20 h-20 rounded-lg border-2 border-dashed border-stone-300 flex flex-col items-center justify-center text-xs text-stone-500 cursor-pointer hover:bg-stone-50">
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => { onFiles(e.target.files); e.target.value = '' }} />
          <ImagePlus size={18} />{busy ? 'Subiendo…' : 'Agregar'}
        </label>
      </div>
      <p className="text-xs text-stone-500 mt-1">La primera es la principal (marcada en amarillo). Desde el celular podés sacar la foto directo.</p>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  )
}
