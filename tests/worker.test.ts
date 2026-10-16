import { afterEach, describe, expect, it, vi } from 'vitest';
import { decide, generation, handle, readBounded } from '../worker/index';
import { contentSchema, requestSchema, type Plan } from '../src/schema';
import { DECIDER, GENERATOR } from '../src/models';
import { CONTENT_PROTOCOL, PROTOCOL_HEADER } from '../src/protocol';

const content = {
  title: 'Website launch', description: 'Tasks for this weekend.', labels: ['Task', 'Category'],
  items: [{ name: 'Write the copy', detail: 'Keep it short.', value: 'Content' }, { name: 'Deploy', detail: 'Check the public URL.', value: 'Release' }],
  metrics: [{ label: 'Tasks', value: '2' }, { label: 'Complete', value: '0' }],
};
const plan: Plan = { view: 'checklist', accent: 'violet', confidence: 0.9, decisionMs: 100, model: DECIDER };
const input = requestSchema.parse({ prompt: 'Make a launch checklist.' });
const limiter = { limit: vi.fn(async () => ({ success: true })) };
const env = { ASSETS: { fetch: vi.fn() }, REQUEST_LIMITER: limiter, GLOBAL_LIMITER: limiter, OPENAI_API_KEY: 'test-key' };
const context = { waitUntil: vi.fn() };
function request(body: unknown = { prompt: 'Make a checklist.' }, extra: Record<string, string> = {}) {
  return new Request('https://keff.uk/pico/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://keff.uk', ...extra }, body: JSON.stringify(body) });
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); limiter.limit.mockResolvedValue({ success: true }); });

describe('request boundary', () => {
  it('rejects cross-origin calls before calling a model', async () => {
    const response = await handle(request(undefined, { Origin: 'https://other.example' }), env as never, context as never);
    expect(response.status).toBe(403);
  });
  it('rejects arbitrary model overrides', async () => {
    expect(requestSchema.safeParse({ prompt: 'Build something', model: 'paid-model' }).success).toBe(false);
    const response = await handle(request({ prompt: 'Build something', model: 'paid-model' }), env as never, context as never);
    expect(response.status).toBe(400);
  });
  it('rejects malformed requests and large bodies', async () => {
    expect((await handle(request({ prompt: 'a' }), env as never, context as never)).status).toBe(400);
    expect((await handle(request({ prompt: 'abc' }, { 'Content-Length': '20000' }), env as never, context as never)).status).toBe(413);
  });
  it('enforces byte limits even without Content-Length', async () => {
    const bytes = new TextEncoder().encode('é'.repeat(20));
    const body = new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } });
    await expect(readBounded(body, 30)).rejects.toThrow('too long');
  });
  it('rejects when the local rate limit is reached', async () => {
    limiter.limit.mockResolvedValue({ success: false });
    expect((await handle(request(), env as never, context as never)).status).toBe(429);
  });
  it('reports an unconfigured secret without exposing credentials', async () => {
    const response = await handle(request(), { ...env, OPENAI_API_KEY: undefined } as never, context as never);
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('test-key');
  });
});

function sse(text: string, terminal = 'response.completed') {
  return `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: text })}\n\ndata: ${JSON.stringify({ type: terminal, response: { model: GENERATOR } })}`;
}

describe('OpenAI Luna contract', () => {
  it('uses native named Decisions choice questions and validates typed answers', async () => {
    const fetcher = vi.fn(async () => Response.json({ answers: [{ type: 'choice', name: 'view', choice: 'checklist', confidence: .9 }, { type: 'choice', name: 'accent', choice: 'violet' }, { type: 'choice', name: 'visual', choice: 'none' }] }));
    const result = await decide(input, 'test-key', new AbortController().signal, fetcher as typeof fetch);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const payload = JSON.parse(options.body as string);
    expect(url).toBe('https://api.openai.com/v1/decisions');
    expect(payload.model).toBe(DECIDER);
    expect(payload.questions).toHaveLength(4);
    expect(payload.questions[0]).toMatchObject({ name: 'view', type: 'choice' });
    expect(payload.questions[0].choices.some((choice: { value: string }) => choice.value === 'gallery')).toBe(true);
    expect(payload.questions.find((question: { name: string }) => question.name === 'accent').choices.some((choice: { value: string }) => choice.value === 'green')).toBe(false);
    expect(JSON.parse(payload.input).request).toBe(input.prompt);
    expect(result).toMatchObject({ view: 'checklist', accent: 'violet', model: DECIDER });
  });
  it('rejects refusals or choices outside the prebuilt catalog', async () => {
    for (const answer of [{ type: 'refusal', name: 'view' }, { type: 'choice', name: 'view', choice: '<script>' }]) {
      const fetcher = vi.fn(async () => Response.json({ answers: [answer] }));
      await expect(decide(input, 'test-key', new AbortController().signal, fetcher as typeof fetch)).rejects.toThrow();
    }
  });
  it('parses fragmented Responses SSE, keeps partial data incremental, and normalizes nullable images', async () => {
    const raw = { ...content, items: content.items.map(item => ({ ...item, image: null })) };
    const message = sse(JSON.stringify(raw)), bytes = new TextEncoder().encode(message);
    const fetcher = vi.fn(async () => new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 13) c.enqueue(bytes.slice(i, i + 13)); c.close(); } })));
    const events = [];
    for await (const event of generation(input, plan, 'test-key', new AbortController().signal, fetcher as typeof fetch)) events.push(event);
    expect(events[0]).toMatchObject({ type: 'delta' });
    expect(events.at(-1)).toEqual({ type: 'content', content, model: GENERATOR });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(body.model).toBe(GENERATOR); expect(body.store).toBe(false);
    expect(body.reasoning).toEqual({ effort: 'none' });
    expect(body.text.format).toMatchObject({ type: 'json_schema', strict: true });
    expect(body.text.format.schema.properties.items.items.required).toContain('image');
    expect(Object.keys(body.text.format.schema.properties)).toEqual(['title', 'items', 'labels', 'metrics', 'description']);
    expect(Object.keys(body.text.format.schema.properties.items.items.properties)).toEqual(['name', 'value', 'image', 'detail']);
  });
  it('streams dashboard metrics before its items and supporting copy', async () => {
    const fetcher = vi.fn(async () => new Response(sse(JSON.stringify(content))));
    for await (const event of generation(input, { ...plan, view: 'dashboard' }, 'test-key', new AbortController().signal, fetcher as typeof fetch)) void event;
    const payload = JSON.parse((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(Object.keys(payload.text.format.schema.properties)).toEqual(['title', 'metrics', 'items', 'labels', 'description']);
  });
  it('never marks empty or truncated model output as complete', async () => {
    for (const text of ['', '{"title":"unfinished', '{}']) {
      const fetcher = vi.fn(async () => new Response(sse(text, 'response.incomplete')));
      await expect(async () => { for await (const event of generation(input, plan, 'test-key', new AbortController().signal, fetcher as typeof fetch)) void event; }).rejects.toThrow('could not finish');
    }
  });
  it('accepts complete validated JSON even if the provider labels it incomplete', async () => {
    const fetcher = vi.fn(async () => new Response(sse(JSON.stringify(content), 'response.incomplete')));
    const events = [];
    for await (const event of generation(input, plan, 'test-key', new AbortController().signal, fetcher as typeof fetch)) events.push(event);
    expect(events.at(-1)?.type).toBe('content');
  });
  it('reads completed output when the connection has no delta frames', async () => {
    const fetcher = vi.fn(async () => new Response(`data: ${JSON.stringify({ type: 'response.completed', response: { model: GENERATOR, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(content) }] }] } })}`));
    const events = [];
    for await (const event of generation(input, plan, 'test-key', new AbortController().signal, fetcher as typeof fetch)) events.push(event);
    expect(events.at(-1)).toEqual({ type: 'content', content, model: GENERATOR });
  });
  it('does not report a failed stream as completed content', async () => {
    const fetcher = vi.fn(async () => new Response(sse(JSON.stringify(content), 'response.failed')));
    await expect(async () => { for await (const event of generation(input, plan, 'test-key', new AbortController().signal, fetcher as typeof fetch)) void event; }).rejects.toThrow('could not complete');
  });
  it('reports provider throttling as a recoverable error', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 429 }));
    await expect(decide(input, 'test-key', new AbortController().signal, fetcher as typeof fetch)).rejects.toThrow('Wait a moment');
  });
  it('propagates cancellation without retrying', async () => {
    const abort = new AbortController();
    const fetcher = vi.fn(async () => { abort.abort(); throw new Error('Stopped'); });
    await expect(async () => { for await (const event of generation(input, plan, 'test-key', abort.signal, fetcher as typeof fetch)) void event; }).rejects.toThrow('Stopped');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('validates bounded output instead of executing generated code', () => {
    expect(contentSchema.safeParse({ ...content, items: [{ name: 'a'.repeat(101), detail: '', value: '' }] }).success).toBe(false);
    expect(contentSchema.safeParse(content).success).toBe(true);
  });
});


describe('open-tab compatibility', () => {
  const legacySchema = contentSchema.extend({ items: contentSchema.shape.items.max(6) });
  for (const [header, maxItems] of [[undefined, 6], ['unknown', 6], [CONTENT_PROTOCOL, 12]] as const) {
    it(`uses a ${maxItems}-item contract for ${header ?? 'an already-open tab'}`, async () => {
      const fetcher = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        const body = JSON.parse(options!.body as string);
        if (String(url).endsWith('/decisions')) return Response.json({ answers: [{ type: 'choice', name: 'view', choice: 'dashboard' }, { type: 'choice', name: 'accent', choice: 'blue' }, { type: 'choice', name: 'visual', choice: 'bars' }] });
        const count = body.text.format.schema.properties.items.maxItems;
        const filled = { ...content, items: Array.from({ length: count }, (_, i) => ({ name: `Category ${i + 1}`, detail: '', value: String(i + 1), image: null })) };
        return new Response(sse(JSON.stringify(filled)));
      });
      vi.stubGlobal('fetch', fetcher);
      const response = await handle(request({ prompt: 'Make a monthly spending dashboard with sample data in euros.' }, header ? { [PROTOCOL_HEADER]: header } : {}), env as never, context as never);
      const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
      const complete = events.find(event => event.type === 'complete');
      expect(events.filter(event => event.type === 'error')).toEqual([]);
      expect(complete.content.items).toHaveLength(maxItems);
      expect((maxItems === 6 ? legacySchema : contentSchema).safeParse(complete.content).success).toBe(true);
      expect(response.headers.get(PROTOCOL_HEADER)).toBe(maxItems === 6 ? '1' : CONTENT_PROTOCOL);
      const decision = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
      const choices = decision.questions.find((question: { name: string }) => question.name === 'view').choices.map((choice: { value: string }) => choice.value);
      expect(choices.includes('calendar')).toBe(maxItems === 12);
      const generated = JSON.parse(fetcher.mock.calls[1][1]!.body as string);
      expect(generated.text.format.schema.properties.items.maxItems).toBe(maxItems);
      expect(generated.instructions).toContain(`Use ${Math.min(8, maxItems)} items by default.`);
    });
  }
  it('rejects oversized legacy output without leaking validation details or dropping entries', async () => {
    const large = { ...content, items: Array.from({ length: 8 }, (_, i) => ({ name: `Item ${i}`, detail: '', value: '1' })) };
    const fetcher = vi.fn(async () => new Response(sse(JSON.stringify(large))));
    await expect(async () => { for await (const event of generation(input, plan, 'test-key', new AbortController().signal, fetcher as typeof fetch, 6)) void event; }).rejects.toThrow('The model could not finish this interface. Try again.');
  });
  it('does not cache the application document', async () => {
    env.ASSETS.fetch.mockResolvedValue(new Response('<!doctype html><title>Pico</title>', { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' } }));
    const response = await handle(new Request('https://keff.uk/pico/'), env as never, context as never);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
