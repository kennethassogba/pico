import { z } from 'zod';
import { requestSchema, viewTypes } from '../src/schema';

export const home = 'https://keff.uk/pico';
export const agentLinks = [
  `<${home}/index.md>; rel="alternate"; type="text/markdown"`,
  `<${home}/.well-known/api-catalog>; rel="api-catalog"`,
  `<${home}/openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"`,
  `<${home}/.well-known/mcp/server-card.json>; rel="mcp-server-card"`,
  `<${home}/.well-known/agent-skills/index.json>; rel="agent-skills"`,
].join(', ');

export const componentCatalog = viewTypes.map(view => ({ view, description: {
  dashboard: 'Summary metrics and a chart.', checklist: 'Editable tasks with checkboxes.',
  form: 'Input fields and local validation.', pricing: 'Selectable plans and prices.',
  board: 'A project board with movable task cards.', gallery: 'A visual collection with selectable cards and local illustrative images.',
  comparison: 'A table comparing options.', itinerary: 'A schedule with times and activities.',
}[view] }));

const guide = `# Pico

Pico turns a prompt into an interactive interface built from eight prebuilt shadcn layouts.

## Connect
- MCP: ${home}/mcp (Streamable HTTP, no authentication)
- OpenAPI: ${home}/openapi.json
- API catalog: ${home}/.well-known/api-catalog
- MCP server card: ${home}/.well-known/mcp/server-card.json
- Agent skill: ${home}/skills/generate-interface/SKILL.md

## Generate an interface
POST ${home}/api/generate with Content-Type: application/json and a JSON body:
\`\`\`json
{"prompt":"Make a launch checklist","history":[]}
\`\`\`
The response is newline-delimited JSON. A plan event selects a layout; delta events stream JSON text; complete returns validated content, the actual generation model and totalMs. Error events contain a recoverable message. Do not treat partial content as complete.

MCP tools: list_components and generate_interface. The generation tool returns the completed interface data. To refine, supply previous: {view, content}. Prompts are 3–1,200 characters; history has at most six user/assistant entries. No model override is accepted.

## Limits and data
OpenAI gpt-6-luna chooses the layout, accent and illustrative image through POST /v1/decisions. The same model fills the chosen layout through POST /v1/responses with strict structured output, reasoning disabled, a 2,600-token output bound and store:false. Prompts, supplied history and previous content go to OpenAI. Pico does not persist conversations. Generated content is illustrative prototype data, not verified live information. Form actions are local demonstrations. No generated code is executed.

Generation has a 15-second server timeout and is limited to six requests per IP and eighteen total per minute per Cloudflare location. MCP and browser generation share these limits. Retry after a minute if throttled. Do not include secrets or personal data in example prompts.
`;

export async function discovery(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  const path = pathname.slice('/pico'.length);
  const headers = { Link: agentLinks, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=300' };
  const body = (text: string, type = 'text/markdown; charset=utf-8') => new Response(request.method === 'HEAD' ? null : text, { headers: { ...headers, 'Content-Type': type, Vary: 'Accept' } });
  const json = (value: unknown, type = 'application/json') => body(JSON.stringify(value), type);
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  if (path === '/index.md' || path === '/llms.txt' || ((path === '' || path === '/') && acceptsMarkdown(request.headers.get('Accept') || ''))) return body(guide);
  const skillDescription = 'Generate or refine a Pico interface from prebuilt shadcn layouts.';
  const skill = `---\nname: generate-interface\ndescription: ${skillDescription}\n---\n\n${guide}`;
  if (path === '/skills/generate-interface/SKILL.md') return body(skill);
  if (path === '/.well-known/agent-skills/index.json') {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(skill));
    const digest = `sha256:${Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')}`;
    return json({ $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json', skills: [{ name: 'generate-interface', type: 'skill-md', description: skillDescription, url: `${home}/skills/generate-interface/SKILL.md`, digest }] });
  }
  if (path === '/.well-known/api-catalog') return json({ linkset: [{ anchor: home, 'service-desc': [{ href: `${home}/openapi.json`, type: 'application/vnd.oai.openapi+json' }], 'service-doc': [{ href: `${home}/index.md`, type: 'text/markdown' }] }] }, 'application/linkset+json');
  if (path === '/.well-known/mcp/server-card.json') return json({
    $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json', version: '1.0', protocolVersion: '2025-11-25',
    serverInfo: { name: 'pico', title: 'Pico', version: '1.1.0' }, description: 'Generate interactive interfaces from prebuilt shadcn components.',
    transport: { type: 'streamable-http', endpoint: `${home}/mcp` }, authentication: { required: false },
    tools: [
      { name: 'list_components', description: 'List the eight available interface layouts.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
      { name: 'generate_interface', description: 'Generate or refine an interface using OpenAI Luna. Returns illustrative prototype content; prompts go to OpenAI.', inputSchema: z.toJSONSchema(requestSchema, { io: 'input' }) },
    ],
  });
  if (path === '/openapi.json') return json({
    openapi: '3.1.0', info: { title: 'Pico', version: '1.1.0', description: 'Generate illustrative interface data using OpenAI Luna. No conversation storage.' }, servers: [{ url: home }],
    paths: {
      '/api/health': { get: { operationId: 'getHealth', responses: { '200': { description: 'Provider configuration and requested model IDs.' } } } },
      '/api/generate': { post: { operationId: 'generateInterface', description: 'Streams plan, delta, complete or error events as NDJSON. Same per-location rate limits as MCP. Browser calls require a same-origin Origin.', requestBody: { required: true, content: { 'application/json': { schema: z.toJSONSchema(requestSchema, { io: 'input' }) } } }, responses: {
        '200': { description: 'NDJSON stream. Only complete events contain validated content; errors may occur after HTTP 200.', content: { 'application/x-ndjson': { schema: { type: 'string' } } } },
        '400': { description: 'Invalid input.' }, '413': { description: 'Body exceeds 16 KB.' }, '429': { description: 'Rate limited; retry after a minute.' }, '503': { description: 'Provider not configured.' },
      } } },
    },
  }, 'application/vnd.oai.openapi+json');
  if (path === '/sitemap.xml') return body(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${home}</loc></url></urlset>`, 'application/xml; charset=utf-8');
  return null;
}

function acceptsMarkdown(accept: string) {
  const entries = accept.split(',').map(part => { const [mime, ...params] = part.trim().split(';'); return { mime, q: Number(params.find(p => p.trim().startsWith('q='))?.trim().slice(2) ?? 1) }; });
  const markdown = entries.find(e => e.mime === 'text/markdown');
  return Boolean(markdown && markdown.q > 0 && markdown.q >= (entries.find(e => e.mime === 'text/html')?.q ?? 0));
}
