'use server'
import { redirect } from 'next/navigation'
import { randomBytes } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { hashPassword, sha, verifyPassword } from '@/lib/auth'
import { currentCustomer, endCustomerSession, startCustomerSession } from '@/lib/customer-auth'
import { notifyStore, sendEmail, siteUrl } from '@/lib/email'

type R = { ok: true; message?: string } | { ok: false; error: string }
const C = schema.customers
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()

const Register = z.object({
  name: z.string().min(2, 'Completá tu nombre').max(90),
  email: z.email('Email inválido').max(200),
  phone: z.string().max(40),
  password: z.string().min(8, 'La contraseña tiene que tener al menos 8 caracteres').max(200),
})

/** Crear cuenta. Si ya compró antes sin registrarse, se "reclama" esa ficha. `wholesale` = pedir cuenta mayorista. */
export async function registerCustomer(_: R | null, f: FormData): Promise<R> {
  const wholesale = f.get('wholesale') === '1'
  const p = Register.safeParse({ name: `${str(f, 'name')} ${str(f, 'surname')}`.trim(), email: str(f, 'email').toLowerCase(), phone: str(f, 'phone'), password: String(f.get('password') ?? '') })
  if (!p.success) return { ok: false, error: p.error.issues[0].message }
  if (String(f.get('password')) !== String(f.get('password2') ?? f.get('password'))) return { ok: false, error: 'Las contraseñas no coinciden' }
  if (wholesale && !p.data.phone) return { ok: false, error: 'Para la cuenta mayorista necesitamos tu teléfono' }
  const { name, email, phone, password } = p.data
  const [existing] = await db.select().from(C).where(eq(C.email, email))
  if (existing?.passwordHash) return { ok: false, error: 'Ya hay una cuenta con ese email. Ingresá o recuperá tu contraseña.' }
  const values = { name, phone: phone || existing?.phone || null, passwordHash: await hashPassword(password), ...(wholesale ? { wholesaleStatus: 'pendiente' as const, wholesaleNote: str(f, 'message').slice(0, 1000) || null } : {}) }
  const [row] = existing
    ? await db.update(C).set(values).where(eq(C.id, existing.id)).returning({ id: C.id })
    : await db.insert(C).values({ email, ...values }).returning({ id: C.id })
  await startCustomerSession(row.id)
  if (wholesale) await notifyStore(`Nueva solicitud de cuenta mayorista: ${name}`, [`${name} (${email}, ${phone}) pidió una cuenta mayorista.`, str(f, 'message') ? `Mensaje: ${str(f, 'message')}` : '', 'Aprobala o rechazala desde Clientes en el panel.'].filter(Boolean), email)
  redirect('/cuenta')
}

export async function loginCustomer(_: R | null, f: FormData): Promise<R> {
  const email = str(f, 'email').toLowerCase()
  const [c] = await db.select().from(C).where(eq(C.email, email))
  if (!c?.passwordHash || !(await verifyPassword(String(f.get('password') ?? ''), c.passwordHash))) return { ok: false, error: 'Email o contraseña incorrectos' }
  await startCustomerSession(c.id)
  const next = str(f, 'next')
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/cuenta')
}

export async function logoutCustomer() {
  await endCustomerSession()
  redirect('/')
}

export async function updateProfile(_: R | null, f: FormData): Promise<R> {
  const me = await currentCustomer()
  if (!me) return { ok: false, error: 'Tu sesión venció, ingresá de nuevo' }
  const name = str(f, 'name')
  if (name.length < 2) return { ok: false, error: 'Completá tu nombre' }
  await db.update(C).set({ name, phone: str(f, 'phone') || null, city: str(f, 'city') || null }).where(eq(C.id, me.id))
  return { ok: true, message: 'Datos guardados' }
}

export async function requestWholesale(_: R | null, f: FormData): Promise<R> {
  const me = await currentCustomer()
  if (!me) return { ok: false, error: 'Tu sesión venció, ingresá de nuevo' }
  if (me.wholesale) return { ok: true, message: 'Tu cuenta ya es mayorista' }
  await db.update(C).set({ wholesaleStatus: 'pendiente', wholesaleNote: str(f, 'message').slice(0, 1000) || null }).where(eq(C.id, me.id))
  await notifyStore(`Nueva solicitud de cuenta mayorista: ${me.name}`, [`${me.name} (${me.email}${me.phone ? ', ' + me.phone : ''}) pidió una cuenta mayorista.`, str(f, 'message') ? `Mensaje: ${str(f, 'message')}` : '', 'Aprobala o rechazala desde Clientes en el panel.'].filter(Boolean), me.email)
  return { ok: true, message: 'Recibimos tu solicitud. Te avisamos por email cuando esté aprobada.' }
}

/** Siempre responde lo mismo (no revela si el email tiene cuenta) */
export async function requestPasswordReset(_: R | null, f: FormData): Promise<R> {
  const email = str(f, 'email').toLowerCase()
  const [c] = await db.select({ id: C.id, name: C.name, hasPw: C.passwordHash }).from(C).where(eq(C.email, email))
  if (c?.hasPw) {
    const token = randomBytes(32).toString('base64url')
    await db.update(C).set({ resetToken: sha(token), resetExpires: new Date(Date.now() + 3600000) }).where(eq(C.id, c.id))
    await sendEmail(email, 'Recuperar tu contraseña de Báltica', 'Recuperar contraseña', [`Hola ${c.name.split(' ')[0]}, para elegir una contraseña nueva tocá el botón. El link vence en 1 hora.`, 'Si no lo pediste, ignorá este email.'], { label: 'Elegir contraseña nueva', url: `${siteUrl()}/cuenta/recuperar?token=${token}` })
  }
  return { ok: true, message: 'Si el email tiene una cuenta, te mandamos un link para elegir una contraseña nueva. Revisá también el correo no deseado.' }
}

export async function resetPassword(_: R | null, f: FormData): Promise<R> {
  const token = str(f, 'token'); const password = String(f.get('password') ?? '')
  if (password.length < 8) return { ok: false, error: 'La contraseña tiene que tener al menos 8 caracteres' }
  const [c] = await db.select({ id: C.id }).from(C).where(and(eq(C.resetToken, sha(token)), gt(C.resetExpires, new Date())))
  if (!c) return { ok: false, error: 'El link venció o ya se usó. Pedí uno nuevo.' }
  await db.update(C).set({ passwordHash: await hashPassword(password), resetToken: null, resetExpires: null }).where(eq(C.id, c.id))
  await db.delete(schema.customerSessions).where(eq(schema.customerSessions.customerId, c.id))
  await startCustomerSession(c.id)
  redirect('/cuenta')
}

/** Formulario de contacto y botón de arrepentimiento: se guarda en el panel y se avisa por email. */
export async function sendMessage(_: R | null, f: FormData): Promise<R> {
  if (str(f, 'website')) return { ok: true, message: 'Mensaje enviado' } // trampa para bots
  const kind = str(f, 'kind') === 'arrepentimiento' ? 'arrepentimiento' : 'contacto'
  const name = str(f, 'name'), email = str(f, 'email').toLowerCase(), body = str(f, 'body'), phone = str(f, 'phone'), orderNumber = str(f, 'order').replace(/^#/, '')
  if (name.length < 2 || !z.email().safeParse(email).success) return { ok: false, error: 'Completá tu nombre y un email válido' }
  if (kind === 'arrepentimiento' && !orderNumber) return { ok: false, error: 'Indicá el número de pedido' }
  if (kind === 'contacto' && body.length < 3) return { ok: false, error: 'Escribí tu mensaje' }
  const [m] = await db.insert(schema.messages).values({ kind, name, email, phone: phone || null, orderNumber: orderNumber || null, body: body.slice(0, 4000) || '(sin aclaraciones)' }).returning({ id: schema.messages.id })
  if (kind === 'arrepentimiento') {
    await notifyStore(`Pedido de arrepentimiento #${m.id} (pedido ${orderNumber})`, [`${name} (${email}${phone ? ', ' + phone : ''}) pidió cancelar la compra del pedido #${orderNumber}.`, body ? `Aclaraciones: ${body}` : '', 'Hay que responder dentro de las 24 horas.'].filter(Boolean), email)
    // La Res. 424/2020 pide darle al cliente un código de la solicitud
    await sendEmail(email, `Recibimos tu solicitud de arrepentimiento #${m.id}`, 'Recibimos tu solicitud', [`Hola ${name.split(' ')[0]}, registramos tu pedido de cancelación de la compra #${orderNumber}.`, `Código de tu solicitud: ${m.id}`, 'Te respondemos dentro de las 24 horas con los pasos a seguir.'])
    return { ok: true, message: `Recibimos tu solicitud. Código: ${m.id}. Te respondemos dentro de las 24 horas.` }
  }
  await notifyStore(`Mensaje de ${name} desde la tienda`, [body, `${email}${phone ? ' · ' + phone : ''}`], email)
  return { ok: true, message: '¡Gracias! Te respondemos a la brevedad.' }
}
