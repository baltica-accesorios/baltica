// MCP stdio adapter for clients without configurable HTTP authorization headers.
// Secrets only come from the client's environment; stdout is reserved for JSON-RPC.
import { createInterface } from 'node:readline'
const endpoint = process.env.BALTICA_MCP_URL
const token = process.env.BALTICA_MCP_TOKEN
if (!endpoint || !token) { console.error('Configurá BALTICA_MCP_URL y BALTICA_MCP_TOKEN'); process.exit(1) }
const url = new URL(endpoint)
if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) { console.error('El servidor MCP requiere HTTPS (excepto localhost)'); process.exit(1) }
const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of input) {
  let message
  try {
    if (line.length > 8_000_000) throw new Error('Solicitud demasiado grande')
    message = JSON.parse(line)
    const res = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' }, body: JSON.stringify(message), redirect: 'error', signal: AbortSignal.timeout(60000) })
    if (!res.ok) throw new Error(`El servidor respondió HTTP ${res.status}`)
    if (res.status !== 202) process.stdout.write(JSON.stringify(await res.json()) + '\n')
  } catch (e) {
    if (message?.id !== undefined) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: e.message } }) + '\n')
    else console.error('No se pudo procesar una notificación MCP')
  }
}
