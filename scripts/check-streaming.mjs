import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { auditColors } from './color-audit.mjs';

const base = process.env.PICO_TEST_URL || 'http://127.0.0.1:5174/pico/';
const content = { title: 'Monthly spending', description: 'Illustrative monthly amounts.', labels: ['Month', 'Amount'], items: [{ name: 'January', detail: '', value: '120' }, { name: 'February', detail: '', value: '180' }, { name: 'March', detail: '', value: '140' }, { name: 'April', detail: '', value: '210' }], metrics: [{ label: 'Spent', value: '€650' }, { label: 'Months', value: '4' }] };
const trip = { title: 'An afternoon in Kyoto', description: 'Illustrative route through the city.', labels: ['Time', 'Activity'], items: [{ name: 'Visit the pagoda', detail: 'Walk through Higashiyama.', value: '14:00' }, { name: 'Stop for coffee', detail: 'Take a break nearby.', value: '16:00' }], metrics: [{ label: 'Stops', value: '2' }, { label: 'Hours', value: '3' }] };
const plan = (view, accent, visual) => ({ view, accent, visual, model: 'inception/mercury-decide:free', decisionMs: 100, confidence: 0.9 });
function feed(content, selected, pause = false) {
  const json = JSON.stringify(content);
  const events = [{ type: 'plan', plan: selected, gate: pause }];
  const boundary = json.indexOf('}', json.indexOf('"items"')) + 1;
  const segments = pause ? [json.slice(0, boundary), json.slice(boundary)] : [json];
  segments.forEach((segment, part) => { for (let i = 0; i < segment.length; i += 64) events.push({ type: 'delta', text: segment.slice(i, i + 64), gate: pause && part === 0 && i + 64 >= segment.length }); });
  events.push({ type: 'complete', content, generationModel: 'explicit-test-fixture:free', totalMs: 2000 });
  return events;
}
const recovery = [
  { type: 'plan', plan: plan('dashboard', 'violet', 'bars') },
  { type: 'delta', text: '{"title":"Discarded partial result","description":"', gate: true },
  { type: 'reset' },
  { type: 'delta', text: JSON.stringify(content) },
  { type: 'complete', content, generationModel: 'explicit-test-recovery:free', totalMs: 2400 },
];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
await fs.mkdir('output/playwright', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  // This browser-only provider fixture verifies actual incremental rendering; production never uses it.
  await page.addInitScript(({ feeds }) => {
    const original = window.fetch.bind(window); let index = 0;
    window.fetch = async (input, init) => {
      if (!String(input).endsWith('/pico/api/generate')) return original(input, init);
      const events = feeds[index++];
      return new Response(new ReadableStream({ async start(controller) {
        for (const event of events) {
          if (init?.signal?.aborted) { controller.error(new DOMException('Stopped', 'AbortError')); return; }
          controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
          if (event.gate) await new Promise(resolve => { window.__picoTestAdvance = resolve; });
          await new Promise(resolve => setTimeout(resolve, 180));
        }
        controller.close();
      } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
    };
  }, { feeds: [feed(content, plan('dashboard', 'blue', 'area'), true), feed(trip, plan('itinerary', 'orange', 'kyoto')), recovery] });
  const advance = () => page.evaluate(() => { window.__picoTestAdvance?.(); window.__picoTestAdvance = undefined; });
  await page.goto(base);
  await page.getByRole('textbox', { name: 'Describe your interface' }).fill('A spending dashboard');
  await page.getByRole('button', { name: 'Generate interface', exact: true }).click();
  await page.getByLabel('Filling interface content').waitFor();
  await page.screenshot({ path: 'output/playwright/synthesis-layout.png' });
  await advance();
  await page.locator('.data-point').first().waitFor();
  assert.ok(await page.locator('.data-point').count() < 4, 'The chart must appear before the full response.');
  assert.equal(await page.getByRole('button', { name: 'Stop generation' }).isVisible(), true);
  await page.screenshot({ path: 'output/playwright/synthesis-partial.png' });
  await advance();
  await page.getByText('Ready to try', { exact: true }).waitFor();
  assert.equal(await page.locator('.data-point').count(), 4);
  assert.equal(await page.locator('.metric-grid [data-slot=card]').count(), 2);
  assert.equal(await page.locator('.generated-view [data-slot=skeleton]').count(), 0);
  await page.screenshot({ path: 'output/playwright/synthesis-complete.png' });
  await page.getByRole('textbox', { name: 'Describe your interface' }).fill('Now plan an afternoon in Kyoto');
  await page.getByRole('button', { name: 'Generate interface', exact: true }).click();
  await page.getByRole('img', { name: 'A pagoda above a narrow street in Kyoto at golden hour.' }).waitFor();
  assert.equal(await page.getByLabel('dashboard preview', { exact: true }).count(), 0);
  await page.getByText('Ready to try', { exact: true }).waitFor();
  assert.equal(await page.locator('.preview-photo img').evaluate(img => img.complete && img.naturalWidth > 0), true);
  await page.screenshot({ path: 'output/playwright/synthesis-photo.png' });
  await page.getByRole('textbox', { name: 'Describe your interface' }).fill('Return to the spending chart');
  await page.getByRole('button', { name: 'Generate interface', exact: true }).click();
  await page.getByRole('heading', { name: 'Discarded partial result', exact: true }).waitFor();
  await advance();
  await page.getByText('Ready to try', { exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Discarded partial result', exact: true }).count(), 0);
  assert.equal(await page.locator('.data-bar').count(), 4);
  assert.equal(await page.getByRole('heading', { name: 'Monthly spending', exact: true }).count(), 1);
  const colors = await auditColors(page);
  assert.equal(colors.every(pair => pair.pass), true, 'Bar chart contrasts must pass across all four themes.');
  await fs.writeFile('output/playwright/colors-bars.json', JSON.stringify(colors, null, 2));
  assert.deepEqual(errors, []);
  console.log('Progressive layout → partial chart → complete content, view changes, local photo and retry reset verified with explicit streaming fixtures.');
} finally { await browser.close(); }
