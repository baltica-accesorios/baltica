import { apiIdentity } from './api-auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { and, eq, gt } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { User } from './types'

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>
const COOKIE = 'baltica_sesion'
const DAYS = 30

export async function hashPassword(pw: string) {
  const salt = randomBytes(16)
  const key = await scryptAsync(pw, salt, 64)
  return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`
}

export async function verifyPassword(pw: string, stored: string) {
  const [, saltHex, keyHex] = stored.split(':')
  if (!saltHex || !keyHex) return false
  const key = await scryptAsync(pw, Buffer.from(saltHex, 'hex'), 64)
  return timingSafeEqual(key, Buffer.from(keyHex, 'hex'))
}

export const sha = (s: string) => createHash('sha256').update(s).digest('hex')

export async function startSession(userId: number) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + DAYS * 86400000)
  await db.insert(schema.sessions).values({ id: sha(token), userId, expiresAt })
  const jar = await cookies()
  jar.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: expiresAt })
}

export async function endSession() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha(token)))
  jar.delete(COOKIE)
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const [row] = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.users.role, active: schema.users.active })
    .from(schema.sessions).innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha(token)), gt(schema.sessions.expiresAt, new Date())))
  if (!row || !row.active) return null
  return { id: row.id, name: row.name, email: row.email, role: row.role }
}

/** Para páginas y acciones del panel. Sin sesión manda al login; con rol insuficiente, al mostrador. */
export async function requireUser(role?: 'duena') {
  const u = apiIdentity.getStore() ?? await currentUser()
  if (!u) redirect('/admin/login')
  if (role && u.role !== role) redirect('/admin/pos')
  return u
}
