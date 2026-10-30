import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { User } from './types'
// Request scoped identity; never accepted from a tool argument.
export const apiIdentity = new AsyncLocalStorage<User>()
export async function authenticateApi(token: string): Promise<User | null> {
  if (!/^bal_[A-Za-z0-9_-]{43}$/.test(token)) return null
  const id = createHash('sha256').update(token).digest('hex')
  const [u] = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.users.role, active: schema.users.active }).from(schema.apiTokens).innerJoin(schema.users, eq(schema.users.id, schema.apiTokens.userId)).where(and(eq(schema.apiTokens.id, id), gt(schema.apiTokens.expiresAt, new Date())))
  return u?.active && u.role === 'duena' ? { id: u.id, name: u.name, email: u.email, role: u.role } : null
}
