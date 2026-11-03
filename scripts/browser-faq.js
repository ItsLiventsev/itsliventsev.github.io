/*
 * Help page (faq.html): answers render, filter works, deep links open, no overflow.
 * Start a local server first, then run:
 * NODE_PATH=/path/to/node_modules BROWSER_BIN=/path/to/chromium node scripts/browser-faq.js
 * Requires playwright-core.
 */
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
const browserArgs = process.env.BROWSER_ARGS ? JSON.parse(process.env.BROWSER_ARGS) : ['--no-sandbox'];
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN, args: browserArgs, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

    await page.goto(base + '/faq.html', { waitUntil: 'load' });

    /* Каждый ответ обязан быть настоящим текстом, а не пустым блоком. */
    const answers = await page.evaluate(() => [...document.querySelectorAll('.faq details')].map(item => {
      const body = item.querySelector('.faq-answer') || item.querySelector('div');
      return {
        id: item.id,
        summary: item.querySelector('summary').textContent.trim(),
        text: body ? body.textContent.replace(/\s+/g, ' ').trim() : '',
        height: body ? Math.round(body.getBoundingClientRect().height) : 0
      };
    }));
    assert(answers.length >= 17, 'в справке меньше 17 вопросов: ' + answers.length);
    for (const item of answers) {
      assert.match(item.id, /^faq-/, 'вопрос без id для деплинка: ' + item.summary);
      assert(item.summary.length > 6, 'пустой вопрос');
      assert(item.text.length > 80, 'пустой ответ: ' + item.summary);
    }

    /* Раскрытый ответ действительно виден. */
    await page.locator('#faq-universes summary').click();
    const opened = await page.evaluate(() => {
      const item = document.getElementById('faq-universes');
      const body = item.querySelector('.faq-answer');
      return { open: item.open, height: Math.round(body.getBoundingClientRect().height), fontSize: getComputedStyle(body).fontSize };
    });
    assert.equal(opened.open, true, 'ответ не раскрывается');
    assert(opened.height > 60, 'раскрытый ответ без высоты: ' + opened.height);
    assert.notEqual(opened.fontSize, '16px', 'ответ остался на браузерном кегле');

    /* Фильтр: сужение, статус и пустое состояние. */
    await page.fill('#faq-filter', 'vlan');
    await page.waitForFunction(() => document.querySelectorAll('.faq details:not([hidden])').length < 17);
    assert.equal(await page.locator('.faq details:not([hidden])').count(), 1, 'фильтр по «vlan» должен оставить один вопрос');
    assert.match(await page.locator('#faq-status').innerText(), /найдено 1 вопрос/);
    await page.fill('#faq-filter', 'квазар');
    await page.waitForSelector('.faq-empty:not([hidden])');
    assert.match(await page.locator('#faq-status').innerText(), /ничего не найдено/);
    await page.locator('#faq-filter').press('Escape');
    await page.waitForFunction(() => document.querySelectorAll('.faq details:not([hidden])').length >= 17);
    assert(await page.locator('.faq-empty').isHidden(), 'пустое состояние не спряталось после сброса');

    /* Деплинк открывает нужный вопрос. */
    await page.goto(base + '/faq.html#faq-xp', { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('faq-xp').open);
    assert(await page.locator('#faq-xp').evaluate(el => el.classList.contains('is-target')), 'деплинк не подсветил вопрос');

    /* Адреса из ответов живут: ссылка на биржу привилегий ведёт на существующую страницу. */
    await page.goto(base + '/faq.html#faq-rewards', { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('faq-rewards').open);
    const rewardHref = await page.locator('#faq-rewards a[href$="rewards.html"]').first().getAttribute('href');
    const response = await page.request.get(new URL(rewardHref, base + '/faq.html').toString());
    assert.equal(response.status(), 200, 'ссылка внутри ответа ведёт в никуда: ' + rewardHref);

    /* Печать раскрывает все ответы. */
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    assert.equal(await page.locator('.faq details[open]').count(), 17, 'печать не раскрыла ответы');

    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/faq.html', { waitUntil: 'load' });
      assert(await noOverflow(page), 'горизонтальная прокрутка на ' + width + 'px');
    }

    assert.deepEqual(errors, []);
    console.log('Browser faq: 17 ответов, фильтр, деплинки, печать и отсутствие прокрутки OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
