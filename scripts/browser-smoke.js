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
    let apiRequests = 0;
    await context.route('https://api.github.com/**', route => {
      apiRequests++;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(commits) });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForSelector('[data-ws-activity-item]');
    const canvas = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ws-canvas').trim());
    assert.equal(canvas.toLowerCase(), '#f8f9fa', 'the light canvas must remain unchanged');
    const courseStyle = await page.locator('.ws-course-violet').first().evaluate(el => ({ border: getComputedStyle(el).borderTopColor, bg: getComputedStyle(el).backgroundImage }));
    assert.match(courseStyle.bg, /linear-gradient/);
    assert.equal(await page.locator('[data-ws-activity-cycle] span[aria-hidden]').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.locator('[data-ws-activity-cycle]').scrollIntoViewIfNeeded();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForSelector('[data-ws-activity-cycle] [data-cycle-active]', { state: 'attached' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('[data-ws-activity-cycle] [data-cycle-active]'));
    assert((await page.locator('main').boundingBox()).y < 200, 'mobile content must start within the first viewport');
    assert.equal(await page.locator('.ws-search-trigger').getAttribute('aria-label'), 'Поиск по материалам, Ctrl K');
    await page.locator('.ws-search-trigger').click();
    const search = page.locator('.ws-search-input');
    await search.fill('сети');
    await page.waitForSelector('.ws-search-result');
    const previousURL = page.url();
    await page.getByRole('button', { name: 'Закрыть поиск' }).click();
    assert.equal(page.url(), previousURL, 'closing search must not navigate');
    assert.equal(await page.locator('.ws-search-dialog').evaluate(el => el.open), false);
    await page.locator('.ws-search-trigger').click();
    await search.fill('> go-projects');
    assert.equal(await page.locator('[data-cmd="go-projects"]').count(), 1);
    await search.fill('> nonsense тему');
    assert.equal(await page.locator('[data-cmd]').count(), 0);
    await page.getByRole('button', { name: 'Закрыть поиск' }).click();
    await page.locator('.ws-mobile-menu').click();
    await page.locator('.ws-nav-link').filter({ hasText: 'Пространства' }).first().click();
    await page.waitForURL('**/stands/index.html');
    const catalogueStyle = await page.locator('.ws-course-violet').first().evaluate(el => ({ border: getComputedStyle(el).borderTopColor, bg: getComputedStyle(el).backgroundImage }));
    assert.deepEqual(catalogueStyle, courseStyle, 'course accents should match across pages');

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
    assert.equal(await page.locator('[data-kanban-card]:visible').count(), 1, 'kanban must respect the selected filter');
    const first = page.locator('[data-kanban-list="done"] [data-kanban-card]:visible').first();
    assert.match(await first.locator('a').getAttribute('href'), /github.com\/.*\/commit\//);
    const cardId = await first.getAttribute('data-kanban-id');
    const card = page.locator('[data-kanban-id="' + cardId + '"]');
    await card.locator('[data-kanban-move="left"]').click();
    assert.equal(await page.locator('[data-kanban-list="progress"] [data-kanban-card]').count(), 1);
    await page.locator('[data-filter="design"]').click();
    assert(await page.locator('.ws-activity-filter-empty').isVisible());
    await page.locator('[data-filter="all"]').click();
    assert.equal(await page.locator('[data-kanban-card]:visible').count(), 2, 'hidden cards survive board moves');
    const other = await context.newPage();
    await other.goto(base + '/', { waitUntil: 'load' });
    await other.waitForSelector('[data-ws-activity-item]');
    assert.equal(apiRequests, 1, 'a new tab should reuse a fresh snapshot');
    await other.locator('[data-ws-view="kanban"]').click();
    await card.locator('[data-kanban-move="left"]').click();
    await other.waitForFunction(id => !!document.querySelector('[data-kanban-list="review"] [data-kanban-id="' + id + '"]'), cardId);
    await card.dragTo(page.locator('[data-kanban-list="done"]'));
    assert.equal(await page.locator('[data-kanban-list="done"] [data-kanban-id="' + cardId + '"]').count(), 1);
    assert.equal(await card.locator('[data-kanban-move="right"]').isDisabled(), true);
    assert.equal(await page.locator('.ws-kanban-list.is-drop-target').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Browser smoke: mobile drawer, indicator, profiles, feed and cross-tab kanban OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
