// Cuentas de clientes de la tienda (separadas de los usuarios del panel).
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { db, schema } from '@/db'
import { sha } from './auth'

const COOKIE = 'baltica_cliente'
const DAYS = 60

export interface CustomerSession { id: number; name: string; email: string; phone: string | null; city: string | null; wholesale: boolean; wholesaleStatus: string }

export async function startCustomerSession(customerId: number) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + DAYS * 86400000)
  await db.insert(schema.customerSessions).values({ id: sha(token), customerId, expiresAt })
  ;(await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: expiresAt })
}

export async function endCustomerSession() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) await db.delete(schema.customerSessions).where(eq(schema.customerSessions.id, sha(token)))
  jar.delete(COOKIE)
}

export async function currentCustomer(): Promise<CustomerSession | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const c = schema.customers
  const [row] = await db.select({ id: c.id, name: c.name, email: c.email, phone: c.phone, city: c.city, wholesaleStatus: c.wholesaleStatus })
    .from(schema.customerSessions).innerJoin(c, eq(c.id, schema.customerSessions.customerId))
    .where(and(eq(schema.customerSessions.id, sha(token)), gt(schema.customerSessions.expiresAt, new Date())))
  if (!row || !row.email) return null
  return { ...row, email: row.email, wholesale: row.wholesaleStatus === 'aprobado' }
}
