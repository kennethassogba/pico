import { describe, expect, it } from 'vitest';
import { discovery } from '../worker/discovery';

describe('agent discovery', () => {
  it('negotiates Markdown without overriding an explicit HTML preference', async () => {
    const markdown = discovery(new Request('https://keff.uk/pico', { headers: { Accept: 'text/markdown' } }))!;
    expect(markdown.headers.get('Content-Type')).toContain('text/markdown');
    expect(markdown.headers.get('Vary')).toBe('Accept');
    expect(await markdown.text()).toContain('/pico/mcp');
    expect(discovery(new Request('https://keff.uk/pico', { headers: { Accept: 'text/markdown;q=0, text/html' } }))).toBeNull();
  });
  it('publishes callable tools and a discoverable OpenAPI document', async () => {
    const card = await discovery(new Request('https://keff.uk/pico/.well-known/mcp/server-card.json'))!.json() as any;
    expect(card.transport.endpoint).toBe('https://keff.uk/pico/mcp');
    expect(card.tools.map((tool: any) => tool.name)).toEqual(['list_components', 'generate_interface']);
    expect(card.tools[1].inputSchema.additionalProperties).toBe(false);
    const catalog = await discovery(new Request('https://keff.uk/pico/.well-known/api-catalog'))!.json() as any;
    expect(catalog.linkset[0]['service-desc'][0].href).toBe('https://keff.uk/pico/openapi.json');
  });
  it('returns an empty body for HEAD and never exposes private data', async () => {
    const response = discovery(new Request('https://keff.uk/pico/index.md', { method: 'HEAD' }))!;
    expect(await response.text()).toBe('');
    const guide = await discovery(new Request('https://keff.uk/pico/index.md'))!.text();
    expect(guide).not.toContain('sk-or-');
    expect(guide).toContain('illustrative prototype');
  });
});
