import assert from 'node:assert/strict';
const base = process.env.PICO_URL || 'https://keff.uk/pico';
// Asset propagation can briefly lag the deployment response at an edge.
// Re-read the document and check every referenced bundle on each bounded retry.
let page, html;
for (let attempt = 0; attempt < 12; attempt++) {
  page = await fetch(`${base}/?release-check=${Date.now()}`, { cache: 'no-store' });
  assert.equal(page.status, 200);
  html = await page.text();
  const paths = [...html.matchAll(/(?:src|href)="(\/pico\/assets\/[^"\s]+)"/g)].map(match => match[1]);
  const checks = await Promise.all(paths.map(async path => {
    const response = await fetch(new URL(path, base), { cache: 'no-store' });
    return response.status === 200 && !response.headers.get('content-type')?.includes('text/html');
  }));
  if (paths.length >= 2 && checks.every(Boolean)) break;
  assert.ok(attempt < 11, 'Referenced assets must resolve to bundles after propagation.');
  await new Promise(resolve => setTimeout(resolve, 1000));
}
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
const health = await fetch(`${base}/api/health`).then(r => r.json());
assert.equal(health.ready, true);
assert.equal(health.decisionModel, 'gpt-6-luna');
assert.equal(health.generationModel, 'gpt-6-luna');
assert.equal(health.provider, 'openai');
assert.equal((await fetch(`${base}/api/generate`)).status, 405);
assert.equal((await fetch(`${base}/api/generate`, { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{"prompt":"a checklist"}' })).status, 403);
console.log('Public page, assets, secret readiness, Luna model and API boundary verified.');
