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

    /* Один сценарий навигации: на стендах тот же таббар, что и на всём сайте,
       а собственная шапка раздела не добавляет вторую строку — её ссылки
       приходят в меню группой «Раздел стендов». */
    await page.goto(base + '/stands/lab-vlan-cisco.html', { waitUntil: 'load' });
    assert(await page.locator('.ui-tabbar').isVisible(), 'на стендах должен быть общий таббар');
    assert.equal(await page.locator('.ui-tabbar a').count(), 5, 'в таббаре пять пунктов и на стенде');
    assert.equal((await page.locator('.ui-tabbar a[aria-current="page"]').innerText()).trim(), 'Практика',
      'на стенде активен пункт «Практика»');
    assert.equal(await page.locator('.ui-subbar').count(), 1, 'подбар раздела должен остаться в разметке');
    assert(!(await page.locator('.ui-subbar').isVisible()), 'на телефоне подбар скрыт — навигация одна');
    const tabbarBox = await page.locator('.ui-tabbar').boundingBox();
    assert(tabbarBox.height >= 44, 'таббар должен быть не ниже 44px: ' + tabbarBox.height);
    await page.locator('.ui-tabbar a[href="#ui-menu"]').click();
    await page.waitForFunction(() => document.querySelector('.ui-drawer')?.dataset.open === 'true');
    assert.equal(await page.locator('.ui-drawer-caption', { hasText: 'Раздел стендов' }).count(), 1,
      'в меню должна быть группа «Раздел стендов»');
    assert(await page.locator('.ui-drawer a', { hasText: 'каталог' }).count() > 0,
      'ссылки раздела должны быть доступны из меню');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.ui-drawer')?.dataset.open === 'false');
    assert(await noOverflow(page), 'стенд без прокрутки на 390px');

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
       Статьи — единственная витрина, которая рисует и строки, и чипы из JSON уже
       после загрузки: здесь проверяется, что контракт видит новую разметку. */
    await page.goto(base + '/articles.html', { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('[data-catalog-search]')?.hidden === false);
    const articleRows = page.locator('#pub-list .catalog-row');
    await articleRows.first().waitFor();
    const articleTotal = await articleRows.count();
    const articleChips = page.locator('#pub-filters [data-catalog-filter]');
    const articleStatus = page.locator('[data-catalog-status]');
    if (await articleChips.count() > 1) {
      await articleChips.nth(1).click();
      const narrowed = await page.locator('#pub-list .catalog-row:visible').count();
      assert(narrowed >= 1 && narrowed <= articleTotal, 'фильтр статей сужает список');
      assert.match(await articleStatus.innerText(), /Найдено: \d+/, 'чип, нарисованный скриптом, обновляет статус');
      assert.equal(await articleChips.nth(1).getAttribute('aria-pressed'), 'true', 'выбранный чип нажат');
      assert.equal(await articleChips.first().getAttribute('aria-pressed'), 'false');
      await articleChips.first().click();
      assert.equal(await page.locator('#pub-list .catalog-row:visible').count(), articleTotal, 'сброс возвращает все статьи');
      assert.equal(await articleStatus.innerText(), '', 'без фильтра статус пуст');
    }
    await page.locator('[data-catalog-search] input').fill('нет такой статьи');
    assert.equal(await page.locator('#pub-list .catalog-row:visible').count(), 0, 'поиск по статьям находит пусто');
    assert.match(await articleStatus.innerText(), /Ничего не найдено/, 'пустой результат объяснён');
    assert.equal(await page.locator('[data-catalog-empty]').isVisible(), true, 'заглушка видна на пустом результате');
    await page.locator('[data-catalog-clear]').click();
    assert.equal(await page.locator('#pub-list .catalog-row:visible').count(), articleTotal, 'очистка возвращает список');
    assert.equal(await page.locator('[data-catalog-empty]').isVisible(), false, 'заглушка снова спрятана');

    /* Проекты: два раздела, фильтр по типу, пустой раздел сворачивается. */
    await page.goto(base + '/projects.html', { waitUntil: 'load' });
    const projectRows = page.locator('.catalog-row');
    const projectTotal = await projectRows.count();
    await page.locator('[data-catalog-filter="case"]').click();
    assert(await page.locator('.catalog-row:visible').count() < projectTotal, 'фильтр проектов сужает список');
    assert.equal(await page.locator('[data-catalog-group]:not([hidden])').count(), 1, 'пустой раздел сворачивается');
    await page.locator('[data-catalog-filter="all"]').click();
    assert.equal(await page.locator('.catalog-row:visible').count(), projectTotal, 'сброс возвращает все проекты');
    assert.equal(await page.locator('[data-catalog-group]:not([hidden])').count(), 2);

    /* Граф связей: стенды — такие же узлы, как заметки. Проверяем, что кнопка
       «стенды» оставляет ровно их, а рубрика не выкидывает практику своей темы. */
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + '/blog/graph.html', { waitUntil: 'load' });
    const graphStands = page.locator('.kn-node--stand');
    const standTotal = await graphStands.count();
    assert(standTotal >= 20, 'на графе мало стендов: ' + standTotal);
    assert(await page.locator('.kn-node').count() > standTotal, 'кроме стендов на графе должны быть заметки');
    await page.locator('[data-graph-zone="stands"]').click();
    assert.equal(await page.locator('.kn-node--stand:visible').count(), standTotal, 'кнопка «стенды» оставляет только стенды');
    assert.equal(await page.locator('.kn-node[data-kind="note"]:visible').count(), 0, 'заметки при фильтре «стенды» скрыты');
    assert.match(await page.locator('[data-graph-status]').innerText(), /Стенды/, 'статус объясняет фильтр стендов');
    await page.locator('[data-graph-zone="linux"]').click();
    assert(await page.locator('.kn-node[data-kind="note"]:visible').count() > 0, 'рубрика оставляет свои заметки');
    assert(await page.locator('.kn-node--stand:visible').count() > 0, 'вместе с рубрикой остаются стенды её темы');
    await page.locator('[data-graph-zone="all"]').click();

    for (const path of ['/', '/projects.html', '/blog/graph.html', '/stands/glossary.html', '/stands/net/net-web.html', '/archive.html', '/faq.html', '/articles/praktiko-orientirovannoe-obuchenie-i-trudoustroystvo-vypusknikov.html', '/projects/esports.html']) {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(base + path, { waitUntil: 'load' });
      assert(await noOverflow(page), 'горизонтальная прокрутка на 360px: ' + path);
      const smallTargets = await page.evaluate(() => [...document.querySelectorAll('.ui-btn, button, .ui-navlink, .ui-tabbar a, .ui-search-open')]
        .filter(el => el.offsetParent && el.getBoundingClientRect().height < 27)
        .map(el => el.className || el.tagName));
      assert.deepEqual(smallTargets, [], 'слишком мелкие кнопки и навигационные цели на ' + path + ': ' + smallTargets.join(' | '));
    }
    /* Живая лента итераций: отдельный контекст без reduced-motion, иначе
       движок честно не запускается и проверять нечего. */
    const liveContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const livePage = await liveContext.newPage(), liveErrors = [];
    livePage.on('pageerror', error => liveErrors.push(error.message));
    await livePage.goto(base + '/', { waitUntil: 'load' });
    await livePage.waitForSelector('.iter-strip.is-live');
    assert.equal(await livePage.locator('.iter-strip [data-state="work"]').count(), 1, 'в ленте ровно один текущий шаг');
    const firstScreen = await livePage.locator('.iter-strip-window').innerText();
    await livePage.waitForTimeout(2800);
    assert.notEqual(await livePage.locator('.iter-strip-window').innerText(), firstScreen, 'лента итераций обновляется сама');
    assert.match(await livePage.locator('[data-iter-clock]').innerText(), /^00:0[1-9]$/, 'секундомер ленты считает время');
    await livePage.locator('[data-iter-toggle]').click();
    assert.equal(await livePage.locator('[data-iter-toggle]').getAttribute('aria-pressed'), 'true', 'пауза выставляется кнопкой');
    assert.match(await livePage.locator('[data-iter-status]').innerText(), /на паузе/, 'статус меняется на «на паузе»');
    const pausedScreen = await livePage.locator('.iter-strip-window').innerText();
    await livePage.waitForTimeout(1800);
    assert.equal(await livePage.locator('.iter-strip-window').innerText(), pausedScreen, 'на паузе лента стоит');
    await livePage.locator('[data-iter-toggle]').click();
    assert.equal(await livePage.locator('[data-iter-toggle]').getAttribute('aria-pressed'), 'false', 'продолжение снимает паузу');
    /* Журнал изменений — вторая инверсная панель: тёмная в светлой теме,
       светлая в тёмной, активный чип глиняный. */
    const journal = await livePage.evaluate(() => {
      const section = getComputedStyle(document.querySelector('#activity'));
      const card = getComputedStyle(document.querySelector('#activity .feed-main'));
      const chip = getComputedStyle(document.querySelector('#activity .feed-filter[aria-pressed="true"]'));
      const title = getComputedStyle(document.querySelector('#activity h2'));
      return { bg: section.backgroundColor, card: card.backgroundColor, chipBg: chip.backgroundColor, chipText: chip.color, title: title.color };
    });
    assert.equal(journal.bg, 'rgb(20, 19, 14)', 'светлая тема: журнал на тёмной панели #14130e');
    assert.notEqual(journal.card, journal.bg, 'карточки журнала должны быть на тон светлее панели');
    assert.equal(journal.chipBg, 'rgb(255, 156, 115)', 'активный фильтр журнала — глиняный');
    assert.equal(journal.chipText, 'rgb(20, 19, 14)', 'текст активного фильтра — тёмный');
    assert.equal(journal.title, 'rgb(248, 247, 242)', 'заголовок журнала — инверсные чернила');

    const surface = await livePage.evaluate(() => {
      const strip = getComputedStyle(document.querySelector('.iter-strip'));
      const root = getComputedStyle(document.documentElement);
      return { bg: strip.backgroundColor, ink: strip.color, paper: root.getPropertyValue('--u-paper').trim() };
    });
    assert.notEqual(surface.bg, surface.paper, 'лента должна быть инверсной, а не цвета бумаги');
    assert.equal(surface.bg, 'rgb(20, 19, 14)', 'светлая тема: подложка ленты тёмная #14130e');
    assert.equal(surface.ink, 'rgb(248, 247, 242)', 'текст на инверсной подложке — #f8f7f2');
    await livePage.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await livePage.waitForTimeout(150);
    assert.equal(await livePage.evaluate(() => getComputedStyle(document.querySelector('.iter-strip')).backgroundColor),
      'rgb(245, 242, 231)', 'тёмная тема: инверсная лента становится светлой');
    assert.equal(await livePage.evaluate(() => getComputedStyle(document.querySelector('#activity')).backgroundColor),
      'rgb(245, 242, 231)', 'тёмная тема: журнал тоже становится светлым');
    assert.equal(await livePage.evaluate(() => getComputedStyle(document.querySelector('#activity .feed-filter[aria-pressed="true"]')).backgroundColor),
      'rgb(168, 57, 29)', 'тёмная тема: активный чип — глиняный');
    await livePage.setViewportSize({ width: 360, height: 800 });
    await livePage.waitForTimeout(150);
    assert(await noOverflow(livePage), 'лента не даёт горизонтальной прокрутки на 360px');
    const pauseBox = await livePage.locator('[data-iter-toggle]').boundingBox();
    assert(pauseBox.height >= 27, 'кнопка паузы должна быть не меньше 27px: ' + pauseBox.height);
    assert.deepEqual(liveErrors, [], 'в живой ленте нет ошибок в консоли');
    await liveContext.close();

    await page.setViewportSize({ width: 1440, height: 900 });
    assert.deepEqual(errors, []);
    console.log('Browser smoke: 360/390 overflow, search dialog, drawer, theme persistence, live iter strip, feed and targets OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
