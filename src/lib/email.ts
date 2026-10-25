// Emails de la tienda (confirmación de pedido, aviso de venta, recuperar contraseña, mayoristas, contacto).
// Usa Resend (resend.com, gratis hasta 3.000 emails por mes). Sin RESEND_API_KEY no se envía nada
// y todo sigue funcionando: los pedidos y mensajes quedan igual en el panel.
import { getSettings } from './data'

export const emailEnabled = () => !!process.env.RESEND_API_KEY

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** Plantilla simple en blanco y negro como la tienda. `lines` son párrafos de texto plano (se escapan). */
function layout(title: string, lines: string[], cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#000;color:#fff;text-align:center;padding:18px;font-weight:bold;letter-spacing:3px;font-size:20px">BÁLTICA</div>
<div style="background:#fff;padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>
${lines.map(l => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px;white-space:pre-line">${esc(l)}</p>`).join('\n')}
${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.url)}" style="background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block;font-weight:bold">${esc(cta.label)}</a></p>` : ''}
</div>
<p style="font-size:12px;color:#888;text-align:center;margin-top:16px">Báltica Accesorios · San Nicolás de los Arroyos</p>
</div></body></html>`
}

export async function sendEmail(to: string, subject: string, title: string, lines: string[], cta?: { label: string; url: string }, replyTo?: string) {
  if (!emailEnabled()) { console.info(`[email desactivado] ${to}: ${subject}`); return false }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Báltica Accesorios <onboarding@resend.dev>', to: [to], subject, html: layout(title, lines, cta), reply_to: replyTo }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) console.error('Resend', res.status, await res.text())
    return res.ok
  } catch (e) { console.error('email', e); return false }
}

/** Aviso a la tienda (al email de Configuración) */
export async function notifyStore(subject: string, lines: string[], replyTo?: string) {
  const s = await getSettings()
  if (s.email) await sendEmail(s.email, subject, subject, lines, { label: 'Abrir el panel', url: `${siteUrl()}/admin` }, replyTo)
}

export const siteUrl = () => (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
