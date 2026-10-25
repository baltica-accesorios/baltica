'use server'
import { redirect } from 'next/navigation'
import { eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { hashPassword, startSession, verifyPassword } from '@/lib/auth'

export async function login(_: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email))
  if (!u || !u.active || !(await verifyPassword(password, u.passwordHash))) return 'Email o contraseña incorrectos'
  await startSession(u.id)
  redirect(u.role === 'duena' ? '/admin' : '/admin/pos')
}

/** Primer ingreso: si todavía no hay usuarios, se crea la cuenta de la dueña. */
export async function setupOwner(_: string | null, form: FormData): Promise<string | null> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.users)
  if (n > 0) return 'La cuenta ya fue creada. Ingresá con tu email.'
  const name = String(form.get('name') ?? '').trim()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  if (!name || !email.includes('@')) return 'Completá nombre y email'
  if (password.length < 8) return 'La contraseña tiene que tener al menos 8 caracteres'
  const [u] = await db.insert(schema.users).values({ name, email, passwordHash: await hashPassword(password), role: 'duena' }).returning({ id: schema.users.id })
  await startSession(u.id)
  redirect('/admin')
}
