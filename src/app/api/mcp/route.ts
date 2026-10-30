import { authenticateApi, apiIdentity } from '@/lib/api-auth'
import { mcpTools } from '@/lib/mcp-tools'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const versions = ['2025-11-25', '2025-06-18', '2025-03-26']
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(process.env.SITE_URL || request.url).origin) return json({ error: 'Origen no permitido' }, 403)
  const user = await authenticateApi(request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '')
  if (!user) return json({ error: 'Token inválido, vencido o revocado' }, 401)
  const protocol = request.headers.get('mcp-protocol-version')
  if (protocol && !versions.includes(protocol)) return json({ error: 'Versión MCP no soportada' }, 400)
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Se requiere application/json' }, 415)
  let body: { jsonrpc?: string; id?: string | number; method?: string; params?: { protocolVersion?: string; name?: string; arguments?: unknown } }
  try {
    const reader = request.body?.getReader(); if (!reader) return json({ error: 'Solicitud vacía' }, 400)
    let size = 0; const chunks: Uint8Array[] = []
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 8_000_000) { await reader.cancel(); return json({ error: 'Solicitud demasiado grande' }, 413) } chunks.push(value) }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } }, 400) }
  const error = (code: number, message: string) => json({ jsonrpc: '2.0', id: body?.id ?? null, error: { code, message } })
  if (!body || Array.isArray(body) || body.jsonrpc !== '2.0' || typeof body.method !== 'string') return error(-32600, 'Solicitud inválida')
  if (body.id === undefined) return new Response(null, { status: 202 })
  if (typeof body.id !== 'string' && typeof body.id !== 'number') return error(-32600, 'ID inválido')
  const result = (result: unknown) => json({ jsonrpc: '2.0', id: body.id, result })
  if (body.method === 'initialize') return result({ protocolVersion: versions.includes(body.params?.protocolVersion ?? '') ? body.params!.protocolVersion : versions[0], capabilities: { tools: {} }, serverInfo: { name: 'baltica', version: '1.1.0' }, instructions: 'Antes de editar, leé los datos actuales. No inventes precios, stock ni fotos. Los cambios se aplican a la tienda. Pedí al usuario los valores que falten.' })
  if (body.method === 'ping') return result({})
  if (body.method === 'tools/list') return result({ tools: mcpTools.map(({ call, ...definition }) => definition) })
  if (body.method === 'tools/call') {
    const tool = mcpTools.find(t => t.name === body.params?.name)
    if (!tool) return error(-32602, 'Herramienta desconocida')
    try {
      const output = await apiIdentity.run(user, () => tool.call(body.params?.arguments ?? {}))
      return result({ content: [{ type: 'text', text: JSON.stringify(output) }], isError: !!output && typeof output === 'object' && 'ok' in output && output.ok === false })
    } catch (e) { return result({ content: [{ type: 'text', text: e instanceof Error ? e.message : 'No se pudo completar la operación' }], isError: true }) }
  }
  return error(-32601, 'Método no soportado')
}
// Stateless JSON responses: no SSE session to resume or terminate.
export async function GET(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(process.env.SITE_URL || request.url).origin) return json({ error: 'Origen no permitido' }, 403)
  if (!await authenticateApi(request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '')) return json({ error: 'No autorizado' }, 401)
  return new Response(null, { status: 405, headers: { Allow: 'POST' } })
}
export const DELETE = GET
