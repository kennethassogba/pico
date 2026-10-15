import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const base = process.env.PICO_TEST_URL || 'http://127.0.0.1:5174/pico/';
const content = { title: 'Launch tasks', description: '', labels: ['Task', 'Category'], items: [{ name: 'Write copy', detail: 'Keep it clear.', value: 'Content' }, { name: 'Deploy', detail: 'Check the URL.', value: 'Release' }], metrics: [{ label: 'Tasks', value: '2' }, { label: 'Done', value: '0' }] };
const plan = { view: 'checklist', accent: 'cyan', visual: 'none', model: 'inception/mercury-decide:free', confidence: .9, decisionMs: 100 };
try {
  for (const mode of ['untouched', 'edited', 'followup']) {
    const page = await browser.newPage();
    await page.addInitScript(({ content, plan }) => {
      const original = window.fetch.bind(window); let count = 0;
      window.fetch = async (url, init) => {
        if (!String(url).endsWith('/pico/api/generate')) return original(url, init);
        const second = ++count > 1;
        return new Response(new ReadableStream({ async start(controller) {
          const send = event => controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
          send({ type: 'plan', plan });
          send({ type: 'complete', content: { ...content, title: second ? 'Follow-up tasks' : content.title }, generationModel: 'explicit-first-fixture:free', totalMs: 300 });
          if (!second) {
            await new Promise(resolve => { window.__releaseQuality = resolve; });
            if (init.signal.aborted) { controller.close(); return; }
            send({ type: 'upgrade', content: { ...content, title: 'Refined launch tasks' }, generationModel: 'explicit-quality-fixture:free', totalMs: 900 });
          }
          controller.close();
        } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
      };
    }, { content, plan });
    await page.goto(base);
    const composer = page.getByRole('textbox', { name: 'Describe your interface' });
    await composer.fill('Make a launch checklist'); await page.getByRole('button', { name: 'Generate interface', exact: true }).click();
    await page.getByRole('heading', { name: 'Launch tasks', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Generate interface', exact: true }).isVisible(), true, 'First complete unlocks the composer while quality is pending.');
    if (mode === 'edited') await page.getByRole('checkbox', { name: 'Complete Write copy' }).check();
    if (mode === 'followup') { await composer.fill('Refine the checklist'); await page.getByRole('button', { name: 'Generate interface', exact: true }).click(); await page.getByRole('heading', { name: 'Follow-up tasks', exact: true }).waitFor(); }
    await page.evaluate(() => window.__releaseQuality());
    if (mode === 'untouched') await page.getByRole('heading', { name: 'Refined launch tasks', exact: true }).waitFor();
    else { await page.waitForTimeout(150); assert.equal(await page.getByRole('heading', { name: mode === 'edited' ? 'Launch tasks' : 'Follow-up tasks', exact: true }).count(), 1); }
    if (mode === 'edited') assert.equal(await page.getByRole('checkbox', { name: 'Complete Write copy' }).isChecked(), true);
    await page.close();
  }
  console.log('First-result interactivity, late quality refinement, edit preservation and follow-up cancellation verified.');
} finally { await browser.close(); }
