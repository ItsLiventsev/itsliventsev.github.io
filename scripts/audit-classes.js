/*
 * Runtime CSS coverage audit for the stands layer.
 *
 * Статический поиск по HTML не видит классы, которые собирает JS — именно так
 * на страницах вселенных появлялись «окна пользователя» без стилей (карточка
 * счёта, рейтинг, панели лиги, ревью). Скрипт загружает страницы в браузере,
 * собирает классы, реально попавшие в DOM, и сверяет их со списком классов,
 * упомянутых в подключённых правилах CSS. Всё, чего нет ни в одном селекторе,
 * — кандидат на «браузерный дефолт».
 *
 * Запуск: python3 -m http.server 8000 & затем
 * NODE_PATH=... BROWSER_BIN=/path/to/chromium node scripts/audit-classes.js
 * Флаги: --json (машинный вывод), --page=/stands/league.html (одна страница).
 */
'use strict';
const { chromium } = require('playwright-core');

const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
const browserArgs = process.env.BROWSER_ARGS ? JSON.parse(process.env.BROWSER_ARGS) : ['--no-sandbox'];

const PAGES = [
  '/stands/index.html',
  '/stands/league.html',
  '/stands/rewards.html',
  '/stands/teams.html',
  '/stands/office/index.html',
  '/stands/office/rewards.html',
  '/stands/ops/index.html',
  '/stands/ops/rewards.html',
  '/stands/setpolis.html',
  '/stands/lab-dns-bind.html',
  '/stands/lab-final.html',
  '/stands/dhcp-alt.html',
  '/stands/switch-ovs.html'
];

/* Служебные классы: состояние, скрытость, якоря — правил может не быть. */
const IGNORE = new Set([
  'sr-only', 'js', 'no-js', 'ui-ready', 'hidden', 'is-hidden', 'active', 'is-active',
  'is-open', 'is-closed', 'is-empty', 'is-ready', 'is-run', 'is-on', 'is-off', 'on', 'off',
  'is-selected', 'is-locked', 'is-current', 'is-done', 'is-busy', 'is-error', 'is-ok',
  /* Области видимости и каркас: класс-маркер, правила ему не нужны. */
  'flat-scope', 'office-scope', 'ops-scope', 'ui-theme', 'st-wrap'
]);

async function collectPage(page, path) {
  await page.goto(base + path, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  /* Раскрываем табы: панели лиги и вселенных живут по одной. */
  const tabs = await page.$$('[role="tab"]');
  for (const tab of tabs) {
    try { await tab.click({ timeout: 700 }); await page.waitForTimeout(120); } catch (error) { /* скрытая вкладка */ }
  }

  return page.evaluate((ignoreList) => {
    const ignore = new Set(ignoreList);

    const rules = new Set();
    const collectFrom = sheet => {
      let list;
      try { list = sheet.cssRules; } catch (error) { return; }
      if (!list) return;
      for (const rule of list) {
        if (rule.selectorText) {
          for (const m of rule.selectorText.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) rules.add(m[1]);
        } else if (rule.cssRules) {
          for (const inner of rule.cssRules) {
            if (inner.selectorText) {
              for (const m of inner.selectorText.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) rules.add(m[1]);
            }
          }
        }
      }
    };
    for (const sheet of document.styleSheets) collectFrom(sheet);

    const used = new Set();
    for (const el of document.querySelectorAll('[class]')) {
      if (el.closest('svg')) continue;
      for (const cls of el.classList) {
        if (!ignore.has(cls) && cls.length > 1) used.add(cls);
      }
    }

    const missing = [...used].filter(cls => !rules.has(cls)).sort();
    return { missing, used: used.size, rules: rules.size };
  }, [...IGNORE]);
}

(async () => {
  const only = (process.argv.find(a => a.startsWith('--page=')) || '').split('=')[1];
  const asJson = process.argv.includes('--json');
  const pages = only ? [only] : PAGES;
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN, args: browserArgs, headless: true });
  const report = {};
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });

    /* Профиль участника: без него окна лиги и биржи остаются за гейтом,
       а league.html вообще уводит на хаб. Пишем ключи напрямую. */
    const seed = await context.newPage();
    await seed.goto(base + '/stands/index.html', { waitUntil: 'load' });
    await seed.evaluate(() => {
      const iso = new Date().toISOString();
      const base = { id: 'stu-1', name: 'Выдра', group: 'ИС-21', mascotId: 'raccoon', createdAt: iso, savedAt: iso };
      localStorage.setItem('stands-profile', JSON.stringify({ ...base, handleNum: 43, tribeId: 'packet' }));
      localStorage.setItem('league-prp', JSON.stringify({ 'stu-1': 5 }));
      localStorage.setItem('league-ledger', JSON.stringify([
        { profileId: 'stu-1', xp: 30, coins: 6, at: iso, reason: 'вход' }
      ]));
      ['ops', 'office'].forEach(prefix => {
        localStorage.setItem(prefix + '-profile', JSON.stringify(base));
        localStorage.setItem(prefix + '-ledger', JSON.stringify([{ profileId: 'stu-1', xp: 25, coins: 4, at: iso }]));
      });
    });
    await seed.close();

    const page = await context.newPage();
    page.on('dialog', dialog => dialog.dismiss());
    for (const path of pages) {
      try {
        report[path] = await collectPage(page, path);
      } catch (error) {
        report[path] = { missing: ['<ошибка: ' + error.message + '>'], used: 0, rules: 0 };
      }
    }
  } finally {
    await browser.close();
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 1));
    return;
  }
  let total = 0;
  const all = new Set();
  for (const [path, data] of Object.entries(report)) {
    total += data.missing.length;
    data.missing.forEach(cls => all.add(cls));
    console.log(String(data.missing.length).padStart(3) + '  ' + path + '  ' + data.missing.join(' '));
  }
  console.log('---');
  console.log('всего классов без правил: ' + total + ', уникальных: ' + all.size);
  /* В CI это защита от регресса: «окна пользователя» собираются из JS, и новый
     класс без правила снова отрендерится браузерным дефолтом. */
  if (total > 0 && process.env.AUDIT_STRICT === '1') process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
