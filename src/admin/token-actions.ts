'use server'
import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, schema } from '@/db'
import { requireUser, sha } from '@/lib/auth'
export async function createApiToken(name: string) {
  const user = await requireUser('duena')
  if (!name.trim() || name.length > 100) throw new Error('Indicá un nombre de hasta 100 caracteres')
  const token = 'bal_' + randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 90 * 86400000)
  await db.insert(schema.apiTokens).values({ id: sha(token), name: name.trim(), userId: user.id, expiresAt })
  revalidatePath('/admin/integraciones')
  return { token, expiresAt: expiresAt.toISOString() }
}
export async function revokeApiToken(id: string) {
  const user = await requireUser('duena')
  await db.delete(schema.apiTokens).where(and(eq(schema.apiTokens.id, id), eq(schema.apiTokens.userId, user.id)))
  revalidatePath('/admin/integraciones')
}
