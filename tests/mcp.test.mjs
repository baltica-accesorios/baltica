import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { Module } from 'node:module'
import { readFileSync } from 'node:fs'
import { AsyncLocalStorage } from 'node:async_hooks'
const identity = new AsyncLocalStorage()
const source = readFileSync(new URL('../src/app/api/mcp/route.ts', import.meta.url), 'utf8')
const mod = new Module('mcp-route-tests')
mod.require = name => {
  if (name.endsWith('api-auth')) return { apiIdentity: identity, authenticateApi: async token => token === 'test-token' ? { id: 7, role: 'duena' } : null }
  if (name.endsWith('mcp-tools')) return { mcpTools: [{ name: 'identity', description: 'Test', inputSchema: { type: 'object' }, call: async () => ({ user: identity.getStore().id }) }] }
  throw new Error('Unexpected dependency ' + name)
}
mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, 'mcp-route-tests.js')
const { POST, GET } = mod.exports
const req = (body, headers = {}) => new Request('http://localhost:3000/api/mcp', { method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
test('MCP rejects unauthorized requests and unexpected browser origins', async () => {
  assert.equal((await POST(req({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { authorization: '' }))).status, 401)
  assert.equal((await POST(req({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { origin: 'https://evil.example' }))).status, 403)
})
test('MCP initialization and notifications follow JSON-RPC', async () => {
  const res = await POST(req({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } }))
  assert.equal((await res.json()).result.protocolVersion, '2025-11-25')
  assert.equal((await POST(req({ jsonrpc: '2.0', method: 'notifications/initialized' }))).status, 202)
})
test('MCP tool invocation carries authenticated identity and hides call implementation', async () => {
  const listed = await (await POST(req({ jsonrpc: '2.0', id: 2, method: 'tools/list' }))).json()
  assert.equal(listed.result.tools[0].call, undefined)
  const called = await (await POST(req({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'identity', arguments: {} } }))).json()
  assert.deepEqual(JSON.parse(called.result.content[0].text), { user: 7 })
  assert.equal(identity.getStore(), undefined)
})
test('MCP rejects batches, unsupported versions and unknown tools', async () => {
  assert.equal((await (await POST(req([]))).json()).error.code, -32600)
  assert.equal((await POST(req({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'mcp-protocol-version': '2099' }))).status, 400)
  const res = await POST(req({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'delete_database' } }))
  assert.equal((await res.json()).error.code, -32602)
})
