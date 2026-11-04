/*
 * Browser interaction smoke test. Start a local server first, then run:
 * NODE_PATH=/path/to/node_modules BROWSER_BIN=/path/to/chromium node scripts/browser-smoke.js
 * Requires playwright-core. BASE_URL defaults to http://127.0.0.1:8000.
 */
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
const browserArgs = process.env.BROWSER_ARGS ? JSON.parse(process.env.BROWSER_ARGS) : ['--no-sandbox'];
const iso = offset => new Date(Date.now() - offset).toISOString();
const snapshot = {
  generated: iso(0),
  total: 3,
  window: 30,
  days: Array.from({ length: 30 }, (_, index) => ({ date: iso((29 - index) * 86400e3).slice(0, 10), count: index === 29 ? 1 : 0 })),
  commits: [
    { sha: 'aaaaaaa', title: 'feat: навигация', date: iso(3600e3), url: 'https://github.com/x/commit/a' },
    { sha: 'bbbbbbb', title: 'fix: контраст кнопок', date: iso(86400e3), url: 'https://github.com/x/commit/b' },
    { sha: 'ccccccc', title: 'docs: материалы', date: iso(2 * 86400e3), url: 'https://github.com/x/commit/c' }
  ]
};
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN, args: browserArgs, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.route('**/assets/data/activity.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(snapshot) }));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForSelector('.feed-item');
    assert(await noOverflow(page), 'нет горизонтальной прокрутки на 390px');
    assert((await page.locator('.ui-masthead').boundingBox()).height < 120, 'шапка компактна на мобильном');
    assert.equal(await page.locator('.ui-search-open').getAttribute('aria-label'), 'Поиск по материалам, Ctrl K');

    await page.locator('.ui-search-open').click();
    await page.locator('.ui-search-input').fill('сети');
    await page.waitForSelector('.ui-search-result');
    const before = page.url();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog.ui-search')?.open);
    assert.equal(page.url(), before, 'закрытие поиска не меняет адрес');

    await page.locator('.ui-menu-open').click();
    await page.waitForSelector('.ui-drawer.is-open', { state: 'visible' }).catch(() => null);
    const drawerLink = page.locator('.ui-drawer a', { hasText: 'Пространства' }).first();
    await drawerLink.click();
    await page.waitForURL('**/stands/index.html');
    assert(await noOverflow(page), 'каталог пространств без прокрутки на 390px');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + '/', { waitUntil: 'load' });
    const toggle = page.locator('[data-ui-theme-toggle]').first();
    await toggle.click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'тема переживает перезагрузку');
    await page.locator('[data-ui-theme-toggle]').first().click();
    assert.notEqual(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');

    await page.waitForSelector('.feed-item');
    assert.equal(await page.locator('[data-activity-chart] i').count(), 14, 'график из 14 столбцов');
    await page.locator('[data-impact="fix"]').click();
    assert.equal(await page.locator('.feed-item').count(), 1, 'фильтр по тегу');
    assert.match(await page.locator('.feed-item h3').first().innerText(), /контраст/);
    assert.notEqual(await page.locator('[data-activity-count]').innerText(), '—');

    /* Каталог: фильтр, поиск и сброс работают на одной разметке во всех витринах.
       Статьи — единственная витрина, которая рисует список из JSON уже после
       загрузки, поэтому проверяем именно здесь: чипы должны видеть новые строки. */
    await page.goto(base + '/articles.html', { waitUntil: 'load' });
    const articleRows = page.locator('#pub-list .catalog-row');
    await articleRows.first().waitFor();
    const articleTotal = await articleRows.count();
    const articleChips = page.locator('#pub-filters [data-catalog-filter]');
    if (await articleChips.count() > 1) {
      await articleChips.nth(1).click();
      const narrowed = await page.locator('#pub-list .catalog-row:visible').count();
      assert(narrowed >= 1 && narrowed <= articleTotal, 'фильтр статей сужает список');
      assert.match(await page.locator('[data-catalog-status]').innerText(), /Найдено:/);
      await articleChips.first().click();
      assert.equal(await page.locator('#pub-list .catalog-row:visible').count(), articleTotal, 'сброс возвращает все статьи');
      await page.locator('[data-catalog-search] input').fill('нет такой статьи');
      assert.equal(await page.locator('#pub-list .catalog-row:visible').count(), 0, 'поиск по статьям находит пусто');
      await page.locator('[data-catalog-clear]').click();
      assert.equal(await page.locator('#pub-list .catalog-row:visible').count(), articleTotal, 'очистка возвращает список');
    }

    for (const path of ['/', '/projects.html', '/stands/glossary.html', '/stands/net/net-web.html', '/archive.html', '/faq.html', '/articles/praktiko-orientirovannoe-obuchenie-i-trudoustroystvo-vypusknikov.html', '/projects/esports.html']) {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(base + path, { waitUntil: 'load' });
      assert(await noOverflow(page), 'горизонтальная прокрутка на 360px: ' + path);
      const smallTargets = await page.evaluate(() => [...document.querySelectorAll('.ui-btn, button, .ui-navlink, .ui-tabbar a, .ui-search-open')]
        .filter(el => el.offsetParent && el.getBoundingClientRect().height < 27)
        .map(el => el.className || el.tagName));
      assert.deepEqual(smallTargets, [], 'слишком мелкие кнопки и навигационные цели на ' + path + ': ' + smallTargets.join(' | '));
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    assert.deepEqual(errors, []);
    console.log('Browser smoke: 360/390 overflow, search dialog, drawer, theme persistence, feed and targets OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
