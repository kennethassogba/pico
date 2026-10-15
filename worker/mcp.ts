import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { requestSchema } from '../src/schema';
import { componentCatalog } from './discovery';
import { z } from 'zod';

export async function mcp(request: Request, ctx: ExecutionContext, generate: (request: Request) => Promise<Response>) {
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: 'pico', version: '1.1.0' });
    server.registerTool('list_components', {
      description: 'List the twelve available prebuilt shadcn interface layouts.', inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async () => ({ content: [{ type: 'text' as const, text: JSON.stringify(componentCatalog) }], structuredContent: { components: componentCatalog } }));
    server.registerTool('generate_interface', {
      description: 'Generate or refine an interface using OpenAI Luna. Prompts and supplied context go to OpenAI. Returns illustrative prototype data. No publication or form submission occurs.',
      inputSchema: requestSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async input => {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      const ip = request.headers.get('CF-Connecting-IP');
      if (ip) headers.set('CF-Connecting-IP', ip);
      const response = await generate(new Request(new URL('/pico/api/generate', request.url), { method: 'POST', headers, signal: request.signal, body: JSON.stringify(input) }));
      const fail = (error: string) => ({ isError: true, content: [{ type: 'text' as const, text: error }] });
      if (!response.ok) return fail((await response.json() as { error: string }).error);
      // Consume the same bounded stream as the UI; never report a partial result as successful.
      const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
      const error = events.find(event => event.type === 'error');
      if (error) return fail(error.error);
      const plan = events.find(event => event.type === 'plan')?.plan;
      const complete = events.findLast(event => event.type === 'upgrade' || event.type === 'complete');
      if (!plan || !complete) return fail('The connection ended before the interface was ready. Try again.');
      const result = { plan, content: complete.content, generationModel: complete.generationModel, totalMs: complete.totalMs, sampleData: true };
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    });
    return server;
  }, { route: '/pico/mcp', responseMode: 'json', corsOptions: false, allowedHostnames: ['keff.uk', 'pico-keff.hodge-podge.workers.dev', 'localhost', '127.0.0.1'], allowedOriginHostnames: ['keff.uk', 'pico-keff.hodge-podge.workers.dev', 'localhost', '127.0.0.1'] });
  return handler(request, {}, ctx);
}
