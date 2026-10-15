import { afterEach, describe, expect, it, vi } from 'vitest';
import { decide, generation, handle, readBounded } from '../worker/index';
import { contentSchema, requestSchema, type Plan } from '../src/schema';
import { GENERATOR, FALLBACK_GENERATOR } from '../src/models';

const content = {
  title: 'Website launch', description: 'Tasks for this weekend.', labels: ['Task', 'Category'],
  items: [{ name: 'Write the copy', detail: 'Keep it short.', value: 'Content' }, { name: 'Deploy', detail: 'Check the public URL.', value: 'Release' }],
  metrics: [{ label: 'Tasks', value: '2' }, { label: 'Complete', value: '0' }],
};
const plan: Plan = { view: 'checklist', accent: 'violet', confidence: 0.9, decisionMs: 100, model: 'inception/mercury-decide:free' };
const input = requestSchema.parse({ prompt: 'Make a launch checklist.' });
const limiter = { limit: vi.fn(async () => ({ success: true })) };
const env = { ASSETS: { fetch: vi.fn() }, REQUEST_LIMITER: limiter, GLOBAL_LIMITER: limiter, OPENROUTER_API_KEY: 'test-key' };
const context = { waitUntil: vi.fn() };
function request(body: unknown = { prompt: 'Make a checklist.' }, extra: Record<string, string> = {}) {
  return new Request('https://keff.uk/pico/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://keff.uk', ...extra }, body: JSON.stringify(body) });
}
afterEach(() => { vi.restoreAllMocks(); limiter.limit.mockResolvedValue({ success: true }); });

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
    const response = await handle(request(), { ...env, OPENROUTER_API_KEY: undefined } as never, context as never);
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('test-key');
  });
});

describe('free provider contract', () => {
  it('uses the real decisions schema and hardcodes the free Mercury endpoint', async () => {
    const fetcher = vi.fn(async () => Response.json({ answers: { view: { choice: 'checklist', confidence: 0.9 }, accent: { choice: 'violet' } } }));
    const result = await decide(input, 'test-key', new AbortController().signal, fetcher as typeof fetch);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const payload = JSON.parse(options.body as string);
    expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
    expect(payload.model).toBe('inception/mercury-decide:free');
    expect(payload.questions.view.type).toBe('choice'); expect(result.view).toBe('checklist');
    expect(payload.questions.accent.criteria).not.toHaveProperty('green');
  });
  it('rejects a view outside the prebuilt catalog', async () => {
    const fetcher = vi.fn(async () => Response.json({ answers: { view: { choice: '<script>' }, accent: { choice: 'violet' } } }));
    await expect(decide(input, 'test-key', new AbortController().signal, fetcher as typeof fetch)).rejects.toThrow();
  });
  it('parses fragmented SSE and validates the final content', async () => {
    const message = `data: ${JSON.stringify({ model: 'provider/model:free', choices: [{ delta: { content: JSON.stringify(content) } }] })}\n\ndata: [DONE]\n\n`;
    const bytes = new TextEncoder().encode(message);
    const fetcher = vi.fn(async () => new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 13) c.enqueue(bytes.slice(i, i + 13)); c.close(); } })));
    const events = [];
    for await (const event of generation(input, plan, 'test-key', new AbortController().signal, fetcher as typeof fetch)) events.push(event);
    expect(events.at(-1)).toEqual({ type: 'content', content, model: 'provider/model:free' });
    const [, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe(GENERATOR);
    expect(body.reasoning).toEqual({ enabled: false });
    expect(body.max_tokens).toBeGreaterThanOrEqual(6000);
  });
  it('never treats two incomplete attempts as a completed interface', async () => {
    const fetcher = vi.fn(async () => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: '{"title":"Hello"' }, finish_reason: 'length' }] })}\n\n`));
    const events: unknown[] = [];
    await expect(async () => { for await (const event of generation(input, plan, 'test-key', new AbortController().signal, fetcher as typeof fetch)) events.push(event); }).rejects.toThrow('could not finish');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(events.some(event => (event as { type: string }).type === 'content')).toBe(false);
  });
  it('automatically recovers from truncated JSON with a clean replacement stream', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: '{"title":"Unfinished' }, finish_reason: 'length' }] })}\n\n`))
      .mockResolvedValueOnce(new Response(`data: ${JSON.stringify({ model: 'provider/recovery:free', choices: [{ delta: { content: JSON.stringify(content) }, finish_reason: 'stop' }] })}`));
    const events = [];
    for await (const event of generation(input, plan, 'test-key', new AbortController().signal, fetcher as typeof fetch)) events.push(event);
    expect(events.map(event => event.type)).toEqual(['delta', 'reset', 'delta', 'content']);
    expect(events.at(-1)).toEqual({ type: 'content', content, model: 'provider/recovery:free' });
    const retry = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(retry.model).toBe(FALLBACK_GENERATOR);
    expect(retry.max_tokens).toBe(8192);
    expect(retry.reasoning.max_tokens).toBe(256);
  });
  it('accepts complete schema-valid JSON even if the provider labels the finish as length', async () => {
    const fetcher = vi.fn(async () => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(content) }, finish_reason: 'length' }] })}\n\n`));
    const events = [];
    for await (const event of generation(input, plan, 'test-key', new AbortController().signal, fetcher as typeof fetch)) events.push(event);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(events.at(-1)?.type).toBe('content');
  });
  it('recovers when reasoning exhausts an attempt before visible content arrives', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'length' }] })}\n\n`))
      .mockResolvedValueOnce(new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(content) }, finish_reason: 'stop' }] })}\n\n`));
    const events = [];
    for await (const event of generation(input, plan, 'test-key', new AbortController().signal, fetcher as typeof fetch)) events.push(event);
    expect(events.map(event => event.type)).toEqual(['reset', 'delta', 'content']);
  });
  it('turns provider throttling into a recoverable message', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 429 }));
    await expect(decide(input, 'test-key', new AbortController().signal, fetcher as typeof fetch)).rejects.toThrow('Wait a minute');
  });
  it('does not start a fallback after the user stops the request', async () => {
    const abort = new AbortController();
    const fetcher = vi.fn(async () => { abort.abort(); throw new DOMException('Stopped', 'AbortError'); });
    await expect(async () => { for await (const event of generation(input, plan, 'test-key', abort.signal, fetcher as typeof fetch)) void event; }).rejects.toThrow('Stopped');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('validates bounded output rather than executing generated code', () => {
    expect(contentSchema.safeParse({ ...content, items: [{ name: 'a'.repeat(101), detail: '', value: '' }] }).success).toBe(false);
    expect(contentSchema.safeParse(content).success).toBe(true);
  });
});
