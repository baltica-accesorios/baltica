'use client'
import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { Camera, Keyboard, X } from 'lucide-react'

/**
 * Lector de códigos de barras.
 * 1) Lector USB/Bluetooth ("keyboard wedge"): el lector escribe el código como si fuera un teclado
 *    y termina con Enter. Detectamos ráfagas de teclas muy rápidas (< 50 ms entre teclas) para
 *    diferenciarlo de alguien escribiendo a mano.
 * 2) Cámara del celular: usamos ZXing sobre getUserMedia (EAN-13, Code128, QR).
 */
export function useKeyboardWedge(onScan: (code: string) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    let buf = ''; let last = 0
    const h = (e: KeyboardEvent) => {
      // Si el foco está en un campo de texto, ese campo procesa el Enter (evita duplicar la lectura)
      const t = e.target as HTMLElement | null
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
      const now = Date.now()
      if (now - last > 80) buf = ''
      last = now
      if (e.key === 'Enter') { if (buf.length >= 6) { onScan(buf); e.preventDefault() } buf = ''; return }
      if (e.key.length === 1) buf += e.key
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onScan, enabled])
}

export function CameraScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState('')
  const [lastCode, setLastCode] = useState('')
  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let controls: IScannerControls | undefined
    let lastAt = 0
    reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current!, (res) => {
      if (res) {
        const code = res.getText(); const now = Date.now()
        if (now - lastAt > 1500) { lastAt = now; setLastCode(code); onScan(code) }
      }
    }).then(c => { controls = c }).catch(e => setErr('No se pudo abrir la cámara: ' + (e?.message ?? e) + '. En producción hace falta HTTPS y dar permiso de cámara.'))
    return () => controls?.stop()
  }, [onScan])
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      <button onClick={onClose} className="absolute top-4 right-4 text-white"><X /></button>
      <div className="text-white text-sm mb-3 flex items-center gap-2"><Camera size={16} /> Apuntá la cámara al código de barras</div>
      <div className="relative w-full max-w-md aspect-[3/4] md:aspect-video rounded-xl overflow-hidden bg-black">
        <video ref={videoRef} className="w-full h-full object-cover" />
        <div className="absolute inset-x-8 top-1/2 h-0.5 bg-red-500/80 animate-pulse" />
      </div>
      {lastCode && <div className="mt-3 text-emerald-300 font-mono">Leído: {lastCode}</div>}
      {err && <div className="mt-3 text-amber-300 text-sm max-w-md text-center">{err}</div>}
      <div className="mt-4 text-stone-400 text-xs flex items-center gap-2"><Keyboard size={14} /> Con un lector USB no hace falta esto: escaneá directo en cualquier pantalla.</div>
    </div>
  )
}

export function Barcode({ value, height = 40, width = 1.4, fontSize = 11, displayValue = true }: { value: string; height?: number; width?: number; fontSize?: number; displayValue?: boolean }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    let cancelled = false
    import('jsbarcode').then(({ default: JsBarcode }) => {
      if (cancelled || !ref.current) return
      try { JsBarcode(ref.current, value, { format: /^\d{13}$/.test(value) ? 'EAN13' : 'CODE128', height, width, fontSize, displayValue, margin: 0, font: 'Inter' }) } catch { /* código inválido */ }
    })
    return () => { cancelled = true }
  }, [value, height, width, fontSize, displayValue])
  return <svg ref={ref} />
}
