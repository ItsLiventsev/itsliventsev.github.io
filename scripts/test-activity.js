/* Optional DOM regression test; requires jsdom, e.g. NODE_PATH=/tmp/site-test/node_modules node scripts/test-activity.js */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('assets/feed.js', 'utf8');
const KEY = 'itsliventsev:activity:v1';
const now = Date.now();
const commits = [
  { sha: 'a'.repeat(40), commit: { message: 'feat: новая навигация\nдлинное описание', committer: { date: new Date(now - 3600e3).toISOString() } } },
  { sha: 'b'.repeat(40), commit: { message: 'fix: контраст кнопок', committer: { date: new Date(now - 86400e3).toISOString() } } },
  { sha: 'c'.repeat(40), commit: { message: 'docs: материалы', committer: { date: new Date(now - 3 * 86400e3).toISOString() } } }
];
function setup(fetch, storage = {}, reduced = true) {
  const dom = new JSDOM(html, { url: 'https://site.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} });
  for (const [name, value] of Object.entries(storage)) w.sessionStorage.setItem(name, value);
  w.fetch = fetch;
  w.eval(script);
  return dom;
}
const success = data => async () => ({ ok: true, json: async () => data });
const wait = () => new Promise(resolve => setTimeout(resolve, 60));
(async () => {
  let dom = setup(success(commits));
  await wait();
  let doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.feed-item').length, 3, 'лента показывает коммиты');
  assert(!doc.querySelector('.feed-item h3').textContent.includes('длинное описание'), 'в заголовок попадает только первая строка коммита');
  assert.equal(doc.querySelectorAll('[data-activity-chart] i').length, 14, 'график всегда 14 дней');
  assert.equal(doc.querySelector('[data-activity-count]').textContent, '3');
  assert.match(doc.querySelector('[data-activity-status]').textContent, /GitHub/);

  doc.querySelector('[data-impact="fix"]').click();
  assert.equal(doc.querySelectorAll('.feed-item').length, 1, 'фильтр по тегу работает');
  assert.match(doc.querySelector('.feed-item h3').textContent, /контраст/);
  assert.equal(doc.querySelector('[data-impact="fix"]').getAttribute('aria-pressed'), 'true');
  doc.querySelector('[data-impact="all"]').click();
  assert.equal(doc.querySelectorAll('.feed-item').length, 3);

  const cached = dom.window.sessionStorage.getItem(KEY);
  assert(cached && JSON.parse(cached).commits.length === 3, 'ответ кэшируется на сессию');
  dom.window.close();

  dom = setup(async () => { throw new Error('offline'); }, { [KEY]: cached });
  await wait();
  doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.feed-item').length, 3);
  assert.match(doc.querySelector('[data-activity-status]').textContent, /сохранённый снимок/);
  dom.window.close();

  dom = setup(async () => { throw new Error('offline'); });
  await wait();
  doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.feed-item').length, 0);
  assert.equal(doc.querySelector('[data-activity-count]').textContent, '—');
  assert.match(doc.querySelector('[data-activity-status]').textContent, /недоступна/);
  dom.window.close();
  console.log('Activity feed: tags, filters, 14-day chart, cache and offline fallback OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
