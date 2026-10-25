// Validación y uso de cupones. El uso se "reserva" con un UPDATE condicional para que un cupón
// de uso limitado no se pueda usar de más aunque dos clientes compren al mismo tiempo.
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { money } from './format'

export const normCode = (c: string) => c.trim().toUpperCase().replace(/\s+/g, '')

export type CouponCheck = { ok: true; code: string; discount: number; freeShipping: boolean; label: string } | { ok: false; error: string }

export async function checkCoupon(raw: string, subtotal: number): Promise<CouponCheck> {
  const code = normCode(raw)
  if (!code) return { ok: false, error: 'Ingresá un código' }
  const [c] = await db.select().from(schema.coupons).where(eq(schema.coupons.code, code))
  if (!c || !c.active) return { ok: false, error: 'Ese cupón no existe' }
  if (c.endsAt && c.endsAt <= new Date()) return { ok: false, error: 'Ese cupón ya venció' }
  if (c.maxUses != null && c.uses >= c.maxUses) return { ok: false, error: 'Ese cupón ya se usó todas las veces posibles' }
  if (subtotal < c.minAmount) return { ok: false, error: `El cupón es para compras desde ${money(c.minAmount)}` }
  const discount = c.type === 'pct' ? Math.round(subtotal * Math.min(100, c.value) / 100) : c.type === 'fixed' ? Math.min(subtotal, c.value) : 0
  const label = c.type === 'pct' ? `${c.value}% OFF` : c.type === 'fixed' ? `${money(c.value)} de descuento` : 'Envío gratis'
  return { ok: true, code, discount, freeShipping: c.type === 'envio', label }
}

/** Suma un uso si todavía quedan. Devuelve false si se agotó justo. */
export async function claimCoupon(code: string) {
  const c = schema.coupons
  const [row] = await db.update(c).set({ uses: sql`${c.uses} + 1` }).where(and(eq(c.code, code), or(isNull(c.maxUses), lt(c.uses, c.maxUses)))).returning({ code: c.code })
  return !!row
}

export async function releaseCoupon(code: string) {
  await db.update(schema.coupons).set({ uses: sql`greatest(0, ${schema.coupons.uses} - 1)` }).where(eq(schema.coupons.code, code))
}
