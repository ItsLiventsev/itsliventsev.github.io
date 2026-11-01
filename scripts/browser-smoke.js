/*
 * Browser interaction smoke test. Start a local server first, then run:
 * NODE_PATH=/path/to/node_modules BROWSER_BIN=/path/to/chromium node scripts/browser-smoke.js
 * Requires playwright-core. BASE_URL defaults to http://127.0.0.1:8000.
 * BROWSER_ARGS may contain a JSON array of additional Chromium flags.
 */
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
const browserArgs = process.env.BROWSER_ARGS ? JSON.parse(process.env.BROWSER_ARGS) : ['--no-sandbox'];
const commits = [
  { sha: 'a'.repeat(40), commit: { message: 'fix: интерфейс', committer: { date: new Date().toISOString() } } },
  { sha: 'b'.repeat(40), commit: { message: 'docs: материалы', committer: { date: new Date().toISOString() } } }
];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN, args: browserArgs, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.route('https://api.github.com/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(commits) }));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForSelector('[data-ws-activity-item]');
    assert((await page.locator('main').boundingBox()).y < 200, 'mobile content must start within the first viewport');
    assert.equal(await page.locator('.ws-search-trigger').getAttribute('aria-label'), 'Поиск по материалам, Ctrl K');
    await page.locator('.ws-mobile-menu').click();
    await page.locator('.ws-nav-link').filter({ hasText: 'Пространства' }).first().click();
    await page.waitForURL('**/stands/index.html');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + '/', { waitUntil: 'load' });
    for (const [label, variant] of [['Заметки', 'general'], ['ДатаПолис', 'directions']]) {
      const link = page.locator('.ws-nav-link').filter({ hasText: label }).first();
      await link.hover();
      await page.waitForTimeout(150);
      const a = await link.boundingBox(), indicator = page.locator('.ws-nav-indicator'), box = await indicator.boundingBox();
      assert.equal(await indicator.getAttribute('data-variant'), variant);
      assert(Math.abs(a.x - box.x) < 3 && Math.abs(a.y - box.y) < 3 && Math.abs(a.width - box.width) < 3, 'indicator must follow hovered link');
    }
    for (const dir of ['ops', 'office']) {
      await page.goto(base + '/stands/' + dir + '/index.html', { waitUntil: 'load' });
      await page.locator('#p-name').fill('Иван Тестов');
      await page.locator('#p-group').fill('ИС-21');
      await page.locator('#gate-form button[type=submit]').click();
      assert.equal(await page.locator('#fp-name').textContent(), 'Иван Тестов');
      assert.equal(await page.locator('#fp-group').textContent(), 'ИС-21');
      if (dir === 'ops') {
        const before = await page.locator('.rr-name').textContent();
        await page.locator('#role-rotate').click();
        assert.notEqual(await page.locator('.rr-name').textContent(), before);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'role-rotate');
      }
    }
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForSelector('[data-ws-activity-item]');
    await page.locator('[data-filter="bugfix"]').click();
    assert.equal(await page.locator('[data-ws-activity-item]:not([data-filtered])').count(), 1);
    await page.locator('[data-ws-view="kanban"]').click();
    const first = page.locator('[data-kanban-list="done"] [data-kanban-card]').first();
    const cardId = await first.getAttribute('data-kanban-id');
    const card = page.locator('[data-kanban-id="' + cardId + '"]');
    await card.locator('[data-kanban-move="left"]').click();
    assert.equal(await page.locator('[data-kanban-list="progress"] [data-kanban-card]').count(), 1);
    const other = await context.newPage();
    await other.goto(base + '/', { waitUntil: 'load' });
    await other.waitForSelector('[data-ws-activity-item]');
    await other.locator('[data-ws-view="kanban"]').click();
    await card.locator('[data-kanban-move="left"]').click();
    await other.waitForFunction(id => !!document.querySelector('[data-kanban-list="review"] [data-kanban-id="' + id + '"]'), cardId);
    assert.deepEqual(errors, []);
    console.log('Browser smoke: mobile drawer, indicator, profiles, feed and cross-tab kanban OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
