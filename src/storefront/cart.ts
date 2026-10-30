'use client'
// Carrito del cliente: vive en su navegador. Guarda una foto del producto para mostrarlo rápido;
// al confirmar la compra el servidor vuelve a leer precios y stock reales.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PublicProduct } from '@/lib/types'
import { variantPrice, variantImages } from '@/lib/variants'
import { currentPrice } from '@/lib/pricing'

export interface CartLine { productId: string; qty: number; variant?: string; name: string; price: number; image: string; stock: number; attr?: string }

interface Cart {
  lines: CartLine[]
  open: boolean
  setOpen: (open: boolean) => void
  add: (p: PublicProduct, qty: number, variant?: string) => void
  update: (productId: string, variant: string | undefined, qty: number) => void
  clear: () => void
}

/** Stock disponible del talle elegido (o del producto si no tiene stock por talle) */
export const variantStockOf = (p: Pick<PublicProduct, 'stock' | 'variantStock'>, variant?: string) => p.variantStock && variant ? p.variantStock[variant] ?? 0 : p.stock

export const unitPrice = (p: Pick<PublicProduct, 'price' | 'offerPrice' | 'offerEndsAt'>) => currentPrice(p)

export const useCart = create<Cart>()(persist((set) => ({
  lines: [],
  open: false,
  setOpen: open => set({ open }),
  add: (p, qty, variant) => set(s => {
    const i = s.lines.findIndex(l => l.productId === p.id && l.variant === variant)
    const snap = { name: p.name, price: variantPrice(p, variant), image: variantImages(p, variant)[0], stock: variantStockOf(p, variant), attr: p.variants?.attr }
    if (i >= 0) { const lines = [...s.lines]; lines[i] = { ...lines[i], ...snap, qty: Math.min(snap.stock, lines[i].qty + qty) }; return { lines, open: true } }
    return { lines: [...s.lines, { productId: p.id, qty: Math.min(snap.stock, qty), variant, ...snap }], open: true }
  }),
  update: (productId, variant, qty) => set(s => ({ lines: s.lines.map(l => l.productId === productId && l.variant === variant ? { ...l, qty } : l).filter(l => l.qty > 0) })),
  clear: () => set({ lines: [] }),
}), { name: 'baltica-carrito', partialize: s => ({ lines: s.lines }) }))
