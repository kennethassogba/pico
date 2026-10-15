import assert from 'node:assert/strict';
const base = process.env.PICO_URL || 'https://keff.uk/pico';
const page = await fetch(base);
assert.equal(page.status, 200);
const html = await page.text();
assert.match(html, /property="og:image" content="https:\/\/keff.uk\/pico\/social-card.png"/);
assert.match(html, /name="twitter:card" content="summary_large_image"/);
assert.match(page.headers.get('Link') || '', /api-catalog/);
const card = await fetch(`${base}/social-card.png`);
assert.equal(card.status, 200);
assert.match(card.headers.get('content-type'), /image\/png/);
const image = Buffer.from(await card.arrayBuffer());
assert.equal(image.readUInt32BE(16), 1200);
assert.equal(image.readUInt32BE(20), 630);
assert.match(html, /Pico/);
assert.match(html, /\/pico\/assets\//);
for (const match of html.matchAll(/(?:src|href)="(\/pico\/assets\/[^"\s]+)"/g)) {
  const response = await fetch(new URL(match[1], base));
  assert.equal(response.status, 200, match[1]);
  assert.ok(!response.headers.get('content-type')?.includes('text/html'), 'Assets must not resolve to the SPA fallback.');
}
const health = await fetch(`${base}/api/health`).then(r => r.json());
assert.equal(health.ready, true);
assert.equal(health.decisionModel, 'inception/mercury-decide:free');
assert.equal((await fetch(`${base}/api/generate`)).status, 405);
assert.equal((await fetch(`${base}/api/generate`, { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{"prompt":"a checklist"}' })).status, 403);
console.log('Public page, assets, secret readiness, free model and API boundary verified.');
