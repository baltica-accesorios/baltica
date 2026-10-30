// Mercado Pago Checkout Pro: el cliente paga en la página de Mercado Pago y vuelve a la tienda.
// El stock de una venta online por MP se descuenta recién cuando el pago queda aprobado
// (webhook o vuelta del cliente, lo que llegue primero; el procesamiento es idempotente).
import { MercadoPagoConfig, Payment, Preference, WebhookSignatureValidator } from 'mercadopago'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { moveItems, StockError } from './stock'
import { saleId } from './data'
import { orderEmails } from './order-emails'
import { notifyStore } from './email'

export const mpEnabled = () => !!process.env.MP_ACCESS_TOKEN
const client = () => new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN!, options: { timeout: 10000 } })
const siteUrl = () => (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

interface PrefInput {
  saleNumber: number
  items: { productId: string; name: string; qty: number; unitPrice: number; image?: string }[]
  discount: number
  shipping: number
  shippingName?: string
  payer: { name: string; email?: string; phone?: string }
}

export async function createPreference(p: PrefInput) {
  const base = siteUrl()
  // Mercado Pago rechaza back_urls/notification_url que no sean públicas (localhost); en desarrollo se omiten.
  const isPublic = base.startsWith('https://')
  // Un solo renglón con el total exacto del pedido: así cupones, descuentos y envío nunca dejan un centavo de diferencia
  const total = p.items.reduce((a, i) => a + i.qty * i.unitPrice, 0) - p.discount + p.shipping
  const first = p.items[0]?.image
  const detail = p.items.map(i => `${i.qty}× ${i.name}`).join(', ') + (p.shipping ? ` + envío (${p.shippingName ?? ''})` : '')
  const items = [{
    id: String(p.saleNumber), title: `Pedido #${p.saleNumber} · Báltica Accesorios`, description: detail.slice(0, 250), quantity: 1, unit_price: total, currency_id: 'ARS',
    picture_url: first?.startsWith('/') ? base + first : first,
  }]
  const res = await new Preference(client()).create({
    body: {
      items,
      external_reference: String(p.saleNumber),
      payer: { name: p.payer.name, email: p.payer.email },
      statement_descriptor: 'BALTICA',
      back_urls: {
        success: `${base}/checkout/resultado`,
        pending: `${base}/checkout/resultado`,
        failure: `${base}/checkout/resultado`,
      },
      ...(isPublic ? { auto_return: 'approved', notification_url: `${base}/api/mercadopago/webhook` } : {}),
      // Si el cliente no paga en 48 h, la preferencia vence
      expires: true,
      expiration_date_to: new Date(Date.now() + 48 * 3600000).toISOString(),
    },
  })
  await db.update(schema.sales).set({ mpPreferenceId: res.id }).where(eq(schema.sales.number, p.saleNumber))
  return res.init_point!
}

export function validateWebhook(headers: Headers, dataId: string | null) {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return // sin secreto configurado no se valida (sólo aceptable en pruebas)
  WebhookSignatureValidator.validate({ xSignature: headers.get('x-signature'), xRequestId: headers.get('x-request-id'), dataId, secret })
}

/**
 * Consulta el pago en Mercado Pago (nunca confiamos en lo que dice la URL o el webhook) y concilia la venta.
 * Devuelve el número de venta afectado.
 */
export async function processPayment(paymentId: string): Promise<number | null> {
  let justPaid = false, toResolve = ''
  const pay = await new Payment(client()).get({ id: paymentId })
  const number = Number(pay.external_reference)
  if (!number) return null
  await db.transaction(async tx => {
    const [sale] = await tx.select().from(schema.sales).where(eq(schema.sales.number, number)).for('update')
    if (!sale || sale.payment !== 'mercadopago') return
    const status = pay.status ?? 'unknown'
    const base = { mpPaymentId: String(pay.id), mpStatus: status }
    const ref = saleId(number)

    if (status === 'approved') {
      if (sale.status !== 'pendiente') { await tx.update(schema.sales).set(base).where(eq(schema.sales.number, number)); return }
      if ((pay.transaction_amount ?? 0) + 0.5 < sale.total) {
        await tx.update(schema.sales).set({ ...base, status: 'a_resolver', paid: true, note: `Mercado Pago aprobó $${pay.transaction_amount} pero el pedido es de $${sale.total}. Revisar.` }).where(eq(schema.sales.number, number))
        return
      }
      const items = await tx.select().from(schema.saleItems).where(eq(schema.saleItems.saleNumber, number))
      try {
        // Savepoint: si falta stock se deshace sólo el descuento, y la venta queda marcada para resolver
        await tx.transaction(inner => moveItems(inner, items, -1, 'venta_online', 'tienda online', ref))
        await tx.update(schema.sales).set({ ...base, status: 'pagada', stockApplied: true, paid: true }).where(eq(schema.sales.number, number))
        justPaid = true
      } catch (e) {
        if (!(e instanceof StockError)) throw e
        await tx.update(schema.sales).set({ ...base, status: 'a_resolver', paid: true, note: `Pago aprobado pero ${e.message}. Reponer, ofrecer alternativa o devolver el dinero desde Mercado Pago.` }).where(eq(schema.sales.number, number))
        toResolve = e.message
      }
      return
    }

    if ((status === 'refunded' || status === 'charged_back') && sale.status !== 'cancelada') {
      if (sale.stockApplied) {
        const items = await tx.select().from(schema.saleItems).where(eq(schema.saleItems.saleNumber, number))
        await moveItems(tx, items, 1, 'devolucion', 'Mercado Pago', ref)
      }
      await tx.update(schema.sales).set({ ...base, status: 'cancelada', stockApplied: false, paid: false, packed: false, delivered: false, note: `Pago ${status === 'refunded' ? 'devuelto' : 'contracargado'} en Mercado Pago` }).where(eq(schema.sales.number, number))
      return
    }

    // pending / in_process / rejected / cancelled: la venta sigue pendiente, sólo registramos el estado
    await tx.update(schema.sales).set(base).where(eq(schema.sales.number, number))
  })
  // Email una sola vez: cuando esta llamada fue la que confirmó el pago
  if (justPaid) await orderEmails(number, 'pagado').catch(e => console.error('orderEmails', e))
  if (toResolve) await notifyStore(`Venta #${number} cobrada sin stock: hay que resolverla`, [`Mercado Pago aprobó el pago pero ${toResolve} (se vendió en el local mientras el cliente pagaba).`, 'Entrá a Ventas para reponer, ofrecer otra cosa o devolver el dinero.']).catch(() => {})
  return number
}
