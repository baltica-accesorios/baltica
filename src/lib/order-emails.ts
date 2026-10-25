// Emails de pedidos online: confirmación al cliente y aviso de venta a la tienda.
import { getSale, getSettings } from './data'
import { money } from './format'
import { notifyStore, sendEmail, siteUrl } from './email'

export async function orderEmails(number: number, event: 'creado' | 'pagado') {
  const sale = await getSale(number)
  if (!sale?.customer?.email) return
  const s = await getSettings()
  const items = sale.items.map(i => `${i.qty} × ${i.name}${i.variant ? ` (${i.variant})` : ''} — ${money(i.qty * i.unitPrice)}`).join('\n')
  const totals = [sale.discount ? `Descuento: −${money(sale.discount)}` : '', sale.shipping ? `Envío (${sale.shippingMethod}): ${money(sale.shipping)}` : `Envío: ${sale.shippingMethod ?? ''}`, `Total: ${money(sale.total)}`].filter(Boolean).join('\n')
  const name = sale.customer.name.split(' ')[0]
  if (event === 'pagado' || sale.payment !== 'mercadopago') {
    const pay = sale.payment === 'transferencia' ? `Para completar tu compra transferí ${money(sale.total)}:\n${s.transferInfo}` : sale.payment === 'efectivo' ? 'Lo pagás en efectivo cuando lo retirás en el showroom.' : 'Tu pago con Mercado Pago fue aprobado.'
    await sendEmail(sale.customer.email, `Tu pedido #${number} en Báltica`, `¡Gracias por tu compra, ${name}!`, [`Pedido #${number}`, items, totals, pay, 'Cualquier consulta respondé este email o escribinos por WhatsApp.'], { label: 'Ver mis pedidos', url: `${siteUrl()}/cuenta` }, s.email)
    await notifyStore(`Nueva venta online #${number} · ${money(sale.total)}`, [`${sale.customer.name} · ${sale.customer.email}${sale.customer.phone ? ' · ' + sale.customer.phone : ''}`, items, totals, `Pago: ${sale.payment}${sale.payment === 'mercadopago' ? ' (aprobado)' : ' (pendiente de confirmar)'}`], sale.customer.email)
  }
}
