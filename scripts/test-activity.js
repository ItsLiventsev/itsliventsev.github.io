/* Optional DOM regression test; requires jsdom, e.g. NODE_PATH=/tmp/site-test/node_modules node scripts/test-activity.js */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('assets/feed.js', 'utf8');
const KEY = 'itsliventsev:activity:v2';
const now = Date.now();
const day = 86400e3;
const iso = offset => new Date(now - offset).toISOString();

/* Снимок так, как его пишет scripts/build-activity.js */
const snapshot = {
  generated: iso(3600e3),
  total: 3,
  window: 30,
  days: Array.from({ length: 30 }, (_, index) => ({
    date: new Date(now - (29 - index) * day).toISOString().slice(0, 10),
    count: index === 29 ? 2 : index === 28 ? 1 : 0
  })),
  commits: [
    { sha: 'aaaaaaa', title: 'feat: новая навигация', date: iso(3600e3), url: 'https://github.com/x/commit/a' },
    { sha: 'bbbbbbb', title: 'fix: контраст кнопок', date: iso(day), url: 'https://github.com/x/commit/b' },
    { sha: 'ccccccc', title: 'docs: материалы практикума', date: iso(3 * day), url: 'https://github.com/x/commit/c' }
  ]
};

/* Ответ GitHub API — только для проверки фолбэка, когда снимка нет */
const apiCommits = snapshot.commits.map(item => ({
  sha: item.sha.padEnd(40, '0'),
  commit: { message: item.title + '\nдлинное описание', committer: { date: item.date } }
}));

function setup(fetch, storage = {}, reduced = true) {
  const dom = new JSDOM(html, { url: 'https://site.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} });
  for (const [name, value] of Object.entries(storage)) w.sessionStorage.setItem(name, value);
  w.fetch = fetch;
  w.eval(script);
  return dom;
}
const okResponse = data => ({ ok: true, json: async () => data });
const json = data => async () => okResponse(data);
const notFound = async () => ({ ok: false, status: 404, json: async () => ({}) });
const wait = () => new Promise(resolve => setTimeout(resolve, 80));

(async () => {
  /* 1. Основной путь: снимок с того же домена */
  let dom = setup(json(snapshot));
  await wait();
  let doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.feed-item').length, 3, 'лента показывает коммиты из снимка');
  assert(doc.querySelector('.feed-item h3').textContent.includes('новая навигация'));
  assert.equal(doc.querySelectorAll('[data-activity-chart] i').length, 14, 'график всегда 14 дней');
  assert.equal(doc.querySelector('[data-activity-count]').textContent, '3', 'счётчик показывает total из снимка');
  assert.equal(doc.querySelector('[data-activity-total]').textContent, '3', 'итог графика — сумма за 14 дней');
  assert.match(doc.querySelector('[data-activity-status]').textContent, /GitHub/);
  assert.match(doc.querySelector('[data-activity-status]').textContent, /Merge-коммиты/, 'статус объясняет, что считается');
  assert.equal(doc.querySelector('[data-activity-sha]').textContent, 'aaaaaaa');
  const bars = [...doc.querySelectorAll('[data-activity-chart] i')];
  assert.equal(bars[13].dataset.empty, undefined, 'сегодняшний столбик не пустой');
  assert(Number(bars[13].dataset.height) >= Number(bars[12].dataset.height), 'высота столбиков соответствует счётчикам');
  assert(bars[0].dataset.empty !== undefined, 'пустые дни помечены явно');

  /* 2. Фильтры */
  doc.querySelector('[data-impact="fix"]').click();
  assert.equal(doc.querySelectorAll('.feed-item').length, 1, 'фильтр по тегу работает');
  assert.match(doc.querySelector('.feed-item h3').textContent, /контраст/);
  assert.equal(doc.querySelector('[data-impact="fix"]').getAttribute('aria-pressed'), 'true');
  doc.querySelector('[data-impact="all"]').click();
  assert.equal(doc.querySelectorAll('.feed-item').length, 3);

  const cached = dom.window.sessionStorage.getItem(KEY);
  assert(cached && JSON.parse(cached).payload.commits.length === 3, 'снимок кэшируется на сессию');
  dom.window.close();

  /* 3. Сеть недоступна, но есть кэш */
  dom = setup(async () => { throw new Error('offline'); }, { [KEY]: cached });
  await wait();
  doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.feed-item').length, 3);
  assert.match(doc.querySelector('[data-activity-status]').textContent, /сохранённый/);
  dom.window.close();

  /* 4. Снимка нет — работаем через API, иначе честно показываем отказ */
  dom = setup(async url => (String(url).includes('activity.json') ? notFound() : okResponse(apiCommits)));
  await wait();
  doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.feed-item').length, 3, 'фолбэк на API работает без снимка');
  assert(!doc.querySelector('.feed-item h3').textContent.includes('длинное описание'), 'в заголовок попадает только первая строка коммита');
  dom.window.close();

  dom = setup(notFound);
  await wait();
  doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.feed-item').length, 0);
  assert.equal(doc.querySelector('[data-activity-count]').textContent, '—');
  assert.match(doc.querySelector('[data-activity-status]').textContent, /недоступна/);
  dom.window.close();

  console.log('Activity feed: snapshot, chart, tags, filters, cache and offline fallback OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
