import { InvalidWebhookSignatureError } from 'mercadopago'
import { processPayment, validateWebhook } from '@/lib/mercadopago'

// Mercado Pago avisa acá cada cambio de un pago. Respondemos 200 rápido; si fallamos, MP reintenta.
export async function POST(req: Request) {
  const url = new URL(req.url)
  const body = await req.json().catch(() => ({})) as { type?: string; action?: string; data?: { id?: string | number } }
  const type = body.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic')
  const id = url.searchParams.get('data.id') ?? (body.data?.id != null ? String(body.data.id) : null)
  if (type !== 'payment' || !id) return new Response('ignorado', { status: 200 })
  try {
    validateWebhook(req.headers, url.searchParams.get('data.id') ?? id)
  } catch (e) {
    if (e instanceof InvalidWebhookSignatureError) return new Response('firma inválida', { status: 401 })
    throw e
  }
  try {
    await processPayment(id)
  } catch (e) {
    console.error('webhook MP', e)
    return new Response('error', { status: 500 })
  }
  return new Response('ok', { status: 200 })
}
