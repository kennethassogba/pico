import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.PICO_TEST_URL || 'http://127.0.0.1:5174/pico/';
await fs.mkdir('output/playwright', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const report = [];
const fixture = {
  title: 'A small project', description: 'Illustrative content for an interface check.', labels: ['Name', 'Details', 'Value'],
  items: [
    { name: 'Write the first draft', detail: 'Keep the main idea clear.', value: '10' },
    { name: 'Review the details', detail: 'Check the important bits.', value: '25' },
    { name: 'Try it on a phone', detail: 'Make room for a small screen.', value: '40' },
    { name: 'Share the result', detail: 'Check the public address.', value: '30' },
  ], metrics: [{ label: 'This week', value: '€120' }, { label: 'Budget', value: '€200' }, { label: 'Remaining', value: '€80' }],
};
const errors = [];
function payload(view) {
  const content = structuredClone(fixture);
  if (view === 'form') { content.labels[0] = 'Send feedback'; content.items = [{ name: 'Name', detail: 'Alex', value: 'text' }, { name: 'Email', detail: 'alex@example.com', value: 'email' }, { name: 'Comment', detail: 'What worked well?', value: 'textarea' }]; }
  if (view === 'pricing') { content.items = [{ name: 'Personal', detail: 'One workspace;Unlimited notes;JSON export', value: '€9 / month' }, { name: 'Team', detail: 'Shared workspaces;Team notes;Priority support', value: '€19 / month' }]; }
  if (view === 'itinerary') content.items = content.items.map((item, i) => ({ ...item, value: `${9 + i}:00` }));
  return [
    { type: 'plan', plan: { view, accent: 'violet', confidence: 0.95, decisionMs: 325, model: 'inception/mercury-decide:free' } },
    { type: 'delta', text: JSON.stringify(content) },
    { type: 'complete', content, generationModel: 'test-fixture:free', totalMs: 1800 },
  ].map(event => JSON.stringify(event)).join('\n') + '\n';
}

try {
  for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    const context = await browser.newContext({ viewport: size, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(base);
    await page.getByRole('heading', { name: 'What would you like to make?' }).waitFor();
    const emptyAudit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    assert.equal(emptyAudit.violations.length, 0, `Empty ${size.width}: ${JSON.stringify(emptyAudit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })))}`);
    await page.screenshot({ path: `output/playwright/empty-${size.width}.png` });
    for (const view of ['dashboard', 'checklist', 'form', 'pricing', 'comparison', 'itinerary']) {
      await page.route('**/pico/api/generate', route => route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: payload(view) }));
      await page.getByRole('textbox', { name: 'Describe your interface' }).fill(`Build a ${view}.`);
      await page.getByRole('button', { name: 'Generate interface', exact: true }).click();
      await page.getByLabel(`${view} preview`, { exact: true }).waitFor();
      await page.getByText('Ready to try', { exact: true }).first().waitFor();
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      assert.equal(audit.violations.length, 0, `${view} ${size.width}: ${JSON.stringify(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })))}`);
      const dimensions = await page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth, width: innerWidth,
        pageHeight: document.documentElement.scrollHeight, height: innerHeight,
        stageWidth: document.querySelector('.preview-stage').clientWidth, stageScrollWidth: document.querySelector('.preview-stage').scrollWidth,
        stageHeight: document.querySelector('.preview-stage').clientHeight, stageScrollHeight: document.querySelector('.preview-stage').scrollHeight,
      }));
      assert.ok(dimensions.pageWidth <= dimensions.width, `Horizontal page overflow: ${view} ${size.width}`);
      assert.ok(dimensions.pageHeight <= dimensions.height, `Page must stay within one viewport: ${view} ${size.width}`);
      assert.ok(dimensions.stageScrollWidth <= dimensions.stageWidth + 1, `Horizontal preview overflow: ${view} ${size.width}`);
      assert.ok(dimensions.stageScrollHeight <= dimensions.stageHeight + 1, `Default preview should fit without scrolling: ${view} ${size.width}`);
      const sendBox = await page.getByRole('button', { name: 'Generate interface', exact: true }).boundingBox();
      assert.ok(sendBox.y >= 0 && sendBox.y + sendBox.height <= size.height, 'Composer must remain reachable.');
      if (view === 'checklist') {
        const checkbox = page.getByRole('checkbox').first(); await checkbox.check(); assert.equal(await checkbox.isChecked(), true);
        while (!(await page.getByText('Share the result', { exact: true }).isVisible())) await page.getByRole('button', { name: 'Next preview page' }).click();
      }
      if (view === 'form') {
        await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Alex');
        if (!(await page.getByRole('textbox', { name: 'Email', exact: true }).isVisible())) await page.getByRole('button', { name: 'Next preview page' }).click();
        await page.getByRole('textbox', { name: 'Email', exact: true }).fill('alex@example.com');
        await page.getByRole('button', { name: 'Send feedback', exact: true }).click();
        await page.getByText('Preview submitted locally. Nothing was sent or saved.', { exact: true }).waitFor();
      }
      if (view === 'pricing') {
        await page.getByRole('button', { name: 'Select Personal', exact: true }).click();
        await page.getByRole('button', { name: 'Selected', exact: true }).waitFor();
      }
      await page.screenshot({ path: `output/playwright/${view}-${size.width}.png` });
      report.push({ view, width: size.width, axe: 'pass', ...dimensions });
      await page.unroute('**/pico/api/generate');
    }
    // Server errors retain the completed preview and offer a direct retry.
    await page.route('**/pico/api/generate', route => route.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"Pico is busy. Wait a minute, then try again."}' }));
    await page.getByRole('textbox', { name: 'Describe your interface' }).fill('Change the layout');
    await page.getByRole('button', { name: 'Generate interface', exact: true }).click();
    await page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
    assert.equal(await page.getByLabel('itinerary preview', { exact: true }).count(), 1);
    await page.getByRole('button', { name: 'About Pico', exact: true }).click();
    await page.getByRole('heading', { name: 'About this interface', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'About Pico', exact: true }).evaluate(el => el === document.activeElement), true);
    await context.close();
  }
  assert.deepEqual(errors, [], 'No client runtime errors');
  await fs.writeFile('output/playwright/report.json', JSON.stringify({ source: 'Deterministic provider fixtures, not a live model benchmark', cases: report }, null, 2));
  console.log(`Verified ${report.length} view/viewport combinations, accessibility, local interactions, recoverable errors, and dialog focus restoration.`);
} finally { await browser.close(); }
