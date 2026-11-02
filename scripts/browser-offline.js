/* Browser offline regression test. Requires playwright-core and a Chromium binary:
 * NODE_PATH=/path/to/node_modules BROWSER_BIN=/path/to/chromium node scripts/browser-offline.js
 * BROWSER_ARGS may contain a JSON array of additional Chromium flags.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    res.setHeader('Connection', 'close');
    if (error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://localhost:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN, args: process.env.BROWSER_ARGS ? JSON.parse(process.env.BROWSER_ARGS) : ['--no-sandbox'], headless: true });
  try {
    const page = await browser.newPage();
    await page.route('https://api.github.com/**', route => route.abort());
    await page.goto(base + '/projects.html', { waitUntil: 'load' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'load' });
    assert(await page.evaluate(() => !!navigator.serviceWorker.controller));
    await new Promise(resolve => server.close(resolve)); // no network, not merely a mocked fetch
    const response = await page.goto(base + '/', { waitUntil: 'load' });
    assert.equal(response.status(), 200);
    await page.waitForSelector('.ws-sidebar');
    await page.locator('[data-reading-filter="all"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-ws-reading] .ws-reading-row').count(), 2);
    const assets = await page.evaluate(async () => ({
      css: (await fetch('/assets/workspace-home.css?v=20261102r9')).status,
      js: (await fetch('/assets/home-activity.js?v=20261102r5')).status,
      reading: (await fetch('/assets/home-reading.js?v=20261102r2')).status,
      publications: (await fetch('/blog/posts.json')).status,
      missing: (await fetch('/assets/missing.js')).status
    }));
    assert.deepEqual(assets, { css: 200, js: 200, reading: 200, publications: 200, missing: 503 });
    await page.evaluate(() => new Promise(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = resolve;
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' }, [channel.port2]);
    }));
    await page.goto(base + '/not-cached.html', { waitUntil: 'load' });
    assert.equal(await page.locator('h1').textContent(), 'Нет соединения');
    console.log('Browser offline: shell, versioned assets and fallback after cache clear OK');
  } finally { server.close(); await browser.close(); }
})().catch(error => { server.close(); console.error(error); process.exitCode = 1; });
