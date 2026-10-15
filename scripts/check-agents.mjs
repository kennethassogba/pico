import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const base = process.env.PICO_URL || 'http://127.0.0.1:5174/pico';
const client = new Client({ name: 'pico-verification', version: '1.0.0' });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(t => t.name).sort(), ['generate_interface', 'list_components']);
  const result = await client.callTool({ name: 'list_components', arguments: {} });
  assert.equal(result.isError, undefined);
  assert.equal(result.structuredContent.components.length, 6);
  // Validation must fail without a model request, and IP limits must remain shared.
  const invalid = await client.callTool({ name: 'generate_interface', arguments: { prompt: 'a', model: 'paid' } });
  assert.equal(invalid.isError, true);
  const blocked = await fetch(`${base}/mcp`, { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(blocked.status, 403);
  const oversized = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(17000) });
  assert.equal(oversized.status, 413);
  const md = await fetch(base, { headers: { Accept: 'text/markdown' } });
  assert.match(md.headers.get('content-type'), /text\/markdown/);
  assert.match(await md.text(), /generate_interface/);
  for (const path of ['/.well-known/api-catalog', '/.well-known/mcp/server-card.json', '/.well-known/agent-skills/index.json', '/openapi.json']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, path);
    await response.json();
  }
  console.log('MCP initialize, tool discovery, component call, input/origin/body boundaries and agent documents verified.');
} finally { await client.close(); }
