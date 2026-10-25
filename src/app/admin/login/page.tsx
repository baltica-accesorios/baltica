import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { currentUser } from '@/lib/auth'
import { LoginForm } from '@/admin/pages/Login'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ingresar al panel', robots: { index: false } }

export default async function Page() {
  if (await currentUser()) redirect('/admin')
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.users)
  return <LoginForm setup={n === 0} />
}
