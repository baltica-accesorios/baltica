import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireUser } from '@/lib/auth'
import { Integrations } from '@/admin/pages/Integrations'
export default async function Page() {
  const user = await requireUser('duena')
  const rows = await db.select({ id: schema.apiTokens.id, name: schema.apiTokens.name, expiresAt: schema.apiTokens.expiresAt }).from(schema.apiTokens).where(eq(schema.apiTokens.userId, user.id))
  return <Integrations tokens={rows.map(t => ({ ...t, expiresAt: t.expiresAt.toISOString() }))} />
}
