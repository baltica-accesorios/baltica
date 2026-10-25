import Link from 'next/link'
import { getSale, getSettings } from '@/lib/data'
import { processPayment } from '@/lib/mercadopago'
import { money } from '@/lib/format'
import { ClearCart } from '@/storefront/components/ClearCart'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tu pedido', robots: { index: false } }

// Mercado Pago vuelve acá con ?payment_id=...&external_reference=<número de pedido>.
// Transferencia/efectivo llegan con ?pedido=<número>.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  let number = Number(sp.pedido ?? sp.external_reference)
  if (sp.payment_id && sp.payment_id !== 'null') {
    // No esperamos al webhook: consultamos el pago ahora mismo (es idempotente)
    try { number = (await processPayment(sp.payment_id)) ?? number } catch (e) { console.error('processPayment', e) }
  }
  const sale = number ? await getSale(number) : null
  const settings = await getSettings()
  if (!sale || sale.channel !== 'online') return <div className="container sf-page"><h1><span>Pedido no encontrado</span></h1><p style={{ textAlign: 'center', marginBottom: 80 }}><Link href="/" style={{ textDecoration: 'underline' }}>Volver a la tienda</Link></p></div>

  const wa = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`Hola! Hice el pedido #${sale.number}`)}`
  const mpFailed = sale.payment === 'mercadopago' && sale.status === 'pendiente' && (sp.status === 'rejected' || sp.collection_status === 'rejected' || sp.status === 'null')
  const paid = sale.status === 'pagada' || sale.status === 'enviada' || sale.status === 'entregada'

  return (
    <div className="container sf-page" style={{ textAlign: 'center', maxWidth: 640 }}>
      {!mpFailed && <ClearCart />}
      {paid ? <>
        <h1><span>¡Gracias por tu compra!</span></h1>
        <p>Tu pago fue aprobado. Pedido <b>#{sale.number}</b> por <b>{money(sale.total)}</b>.</p>
        <p style={{ color: '#666' }}>Te vamos a escribir para coordinar {sale.shippingMethod?.toLowerCase().includes('retiro') ? 'el retiro' : 'el envío'}.</p>
      </> : sale.status === 'a_resolver' ? <>
        <h1><span>Recibimos tu pago</span></h1>
        <p>Pedido <b>#{sale.number}</b>. Uno de los productos se vendió en el local justo mientras pagabas. Te escribimos hoy mismo para ofrecerte una alternativa o devolverte el dinero.</p>
      </> : mpFailed ? <>
        <h1><span>El pago no se completó</span></h1>
        <p>No se cobró nada. Podés volver a intentarlo desde el carrito o elegir transferencia.</p>
        <p><Link href="/checkout" className="sf-btn" style={{ marginTop: 10 }}>Volver a intentar</Link></p>
      </> : sale.payment === 'mercadopago' ? <>
        <h1><span>Pago en proceso</span></h1>
        <p>Pedido <b>#{sale.number}</b>. Mercado Pago está procesando tu pago; te avisamos apenas se acredite.</p>
      </> : <>
        <h1><span>¡Pedido recibido!</span></h1>
        <p>Pedido <b>#{sale.number}</b> por <b>{money(sale.total)}</b>.</p>
        {sale.payment === 'transferencia' ? <div style={{ background: '#f5f5f5', borderRadius: 6, padding: 20, margin: '20px 0', textAlign: 'left' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700 }}>Transferí {money(sale.total)} a:</p>
          <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{settings.transferInfo}</p>
          <p style={{ margin: '12px 0 0', fontSize: 14, color: '#666' }}>Mandanos el comprobante por WhatsApp. Reservamos tu pedido por 48 horas.</p>
        </div> : <p>Lo pagás en efectivo cuando lo retirás en el showroom.</p>}
      </>}
      <p style={{ margin: '30px 0 80px' }}><a href={wa} target="_blank" rel="noreferrer" className="sf-btn">Escribinos por WhatsApp</a></p>
    </div>
  )
}
