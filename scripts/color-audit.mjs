import { APCAcontrast, sRGBtoY } from 'apca-w3';

export async function auditColors(page) {
  const results = [];
  for (const accent of ['violet', 'blue', 'rose', 'orange']) {
    const pairs = await page.evaluate(accent => {
      const root = document.querySelector('.generated-view');
      const old = root.dataset.accent;
      root.dataset.accent = accent;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const rgba = value => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
      const background = element => {
        const chain = []; for (let node = element; node; node = node.parentElement) chain.unshift(node);
        let rgb = [0, 0, 0];
        for (const node of chain) { const c = rgba(getComputedStyle(node).backgroundColor); rgb = rgb.map((v, i) => c[i] * c[3] / 255 + v * (1 - c[3] / 255)); }
        return rgb;
      };
      const selectors = ['.view-heading h2', '.view-heading p', '.metric-grid span', '.metric-grid strong', '.chart-heading h3', '.chart-legend', '.chart-axis strong', '.chart-axis > span > span', '.task-overview > div > strong', '.task-overview > div > span', '.completion-ring > strong', '.task-copy strong', '.task-copy > span', '[data-slot=badge]', '.field-label', '.preview-primary', '.price', '.price-top h3', '.price-card li', '.price-card button', '.comparison-name', '.comparison-value', '.comparison-wrap th', '.comparison-wrap td', '.itinerary-row h3', '.itinerary-row p', '.time'];
      const pairs = [];
      for (const selector of selectors) for (const el of root.querySelectorAll(selector)) {
        if (!el.getClientRects().length || el.closest('[hidden]') || el.closest(':disabled') || !el.textContent.trim()) continue;
        const style = getComputedStyle(el);
        pairs.push({ selector, kind: 'text', fg: rgba(style.color).slice(0, 3), bg: background(el), size: parseFloat(style.fontSize), weight: parseFloat(style.fontWeight) });
      }
      for (const selector of ['.data-line', '.data-bar', '.ring-value']) for (const el of root.querySelectorAll(selector)) {
        const rect = el.getBoundingClientRect(); if (!rect.width || !rect.height) continue;
        const style = getComputedStyle(el);
        pairs.push({ selector, kind: 'graphic', fg: rgba(selector === '.data-bar' ? style.fill : style.stroke).slice(0, 3), bg: background(el) });
      }
      root.dataset.accent = old;
      return pairs;
    }, accent);
    const luminance = rgb => rgb.map(v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    for (const pair of pairs) {
      const a = luminance(pair.fg), b = luminance(pair.bg);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const threshold = pair.kind === 'graphic' || pair.size >= 24 || (pair.weight >= 700 && pair.size >= 18.67) ? 3 : 4.5;
      const apca = APCAcontrast(sRGBtoY(pair.fg), sRGBtoY(pair.bg));
      results.push({ accent, ...pair, ratio, threshold, apca, pass: ratio >= threshold });
    }
  }
  return results;
}
