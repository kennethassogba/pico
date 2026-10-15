import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
const engines = process.env.PICO_WEBKIT ? [chromium, webkit] : [chromium];
const base = process.env.PICO_TEST_URL || 'http://127.0.0.1:5174/pico/';
await fs.mkdir('output/playwright', { recursive: true });
const results = [];
for (const engine of engines) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.goto(base);
    await page.getByRole('heading', { name: 'What would you like to make?' }).waitFor();
    async function check(state, height, top = 0) {
      await page.waitForFunction(({ height, top }) => {
        const rect = document.querySelector('.app-shell').getBoundingClientRect();
        return Math.abs(rect.height - height) < 2 && Math.abs(rect.top - top) < 2;
      }, { height, top });
      const form = await page.locator('.composer').boundingBox();
      const field = await page.locator('#prompt').boundingBox();
      const example = await page.locator('.examples').boundingBox();
      assert.ok(Math.abs(top + height - form.y - form.height) <= 40, `${engine.name()} ${state}: composer must touch the lower safe area.`);
      assert.ok(field.y >= top && field.y + field.height <= top + height, 'The entire text field must remain reachable.');
      assert.ok(example.y + example.height <= form.y, 'Examples must stay above the text box.');
      results.push({ engine: engine.name(), state, height, top, composerBottom: form.y + form.height });
    }
    await check('empty', 844);
    await page.screenshot({ path: `output/playwright/mobile-bottom-${engine.name()}.png` });
    await page.locator('#prompt').focus(); await page.locator('#prompt').fill('Build a coffee menu');
    await page.setViewportSize({ width: 390, height: 390 });
    await check('keyboard-height', 390);
    await page.screenshot({ path: `output/playwright/mobile-keyboard-${engine.name()}.png` });
    // A panned iOS visual viewport has both a smaller height and nonzero offsetTop.
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, get: () => 340 });
      Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, get: () => 40 });
      window.visualViewport.dispatchEvent(new Event('resize'));
      window.visualViewport.dispatchEvent(new Event('scroll'));
    });
    await check('panned-visual-viewport', 340, 40);
    await page.close();
  } finally { await browser.close(); }
}
await fs.writeFile('output/playwright/mobile-composer.json', JSON.stringify(results, null, 2));
console.log('Bottom composer verified on empty, keyboard-height and panned visual viewports:', results.map(r => `${r.engine}/${r.state}`).join(', '));
