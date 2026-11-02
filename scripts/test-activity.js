/* Optional DOM regression test; requires jsdom, e.g. NODE_PATH=/tmp/site-test/node_modules node scripts/test-activity.js */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('assets/home-activity.js', 'utf8');
const key = 'itsliventsev-home-activity-v2';
const boardKey = 'ws:kanban:order:v13';
const commits = [
  { sha: 'a'.repeat(40), commit: { message: 'fix: исправление\nдлинное описание', committer: { date: new Date().toISOString() } } },
  { sha: 'b'.repeat(40), commit: { message: 'docs: материалы', committer: { date: new Date().toISOString() } } }
];
function setup(fetch, storage = {}, reduced = true) {
  const dom = new JSDOM(html, { url: 'https://site.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: reduced });
  for (const [name, value] of Object.entries(storage)) w.localStorage.setItem(name, value);
  w.fetch = fetch;
  w.eval(script);
  return dom;
}
const success = data => async () => ({ ok: true, json: async () => data });
const wait = () => new Promise(resolve => setTimeout(resolve, 60));
(async () => {
  let dom = setup(success(commits));
  await wait();
  let w = dom.window, doc = w.document;
  assert.equal(doc.querySelectorAll('[data-ws-activity-item]').length, 2);
  assert(!doc.querySelector('[data-ws-activity-item] strong').textContent.includes('длинное описание'));
  doc.querySelector('[data-filter="bugfix"]').click();
  doc.querySelector('[data-ws-view="kanban"]').click();
  assert.equal(doc.querySelectorAll('[data-kanban-card]:not([hidden])').length, 1);
  doc.querySelector('[data-kanban-id^="aaa"] [data-kanban-move="left"]').click();
  assert.equal(doc.querySelector('[data-kanban-count="progress"]').textContent, '1');
  assert.equal(JSON.parse(w.localStorage.getItem(boardKey)).payload.done.length, 1); // hidden cards survive a move
  doc.querySelector('[data-filter="design"]').click();
  assert.equal(doc.querySelector('.ws-activity-filter-empty').hidden, false);
  doc.querySelector('[data-filter="all"]').click();
  assert.equal(doc.querySelectorAll('[data-kanban-card]:not([hidden])').length, 2);
  const snapshot = w.localStorage.getItem(key), board = w.localStorage.getItem(boardKey);
  assert(snapshot);
  dom.window.close();

  let requests = 0;
  dom = setup(async () => { requests++; throw Error('offline'); }, { [key]: snapshot, [boardKey]: board });
  await wait();
  assert.equal(requests, 0); // a fresh snapshot works in a new tab/session
  assert.equal(dom.window.document.querySelectorAll('[data-ws-activity-item]').length, 2);
  assert.equal(dom.window.document.querySelectorAll('[data-kanban-list="progress"] [data-kanban-card]').length, 1);
  dom.window.close();

  dom = setup(async () => { throw Error('offline'); });
  await wait();
  w = dom.window; doc = w.document;
  doc.querySelector('[data-ws-view="kanban"]').click();
  assert.match(doc.querySelector('.ws-activity-filter-empty').textContent, /Не удалось загрузить/);
  w.fetch = success(commits);
  w.dispatchEvent(new w.Event('online'));
  await wait();
  assert.equal(doc.querySelectorAll('[data-ws-activity-item]').length, 2);
  assert.equal(doc.querySelector('.ws-activity-filter-empty').hidden, true);
  dom.window.close();

  const many = Array.from({ length: 100 }, (_, i) => ({ sha: i.toString(16).padStart(40, '0'), commit: { message: 'update', committer: { date: new Date().toISOString() } } }));
  dom = setup(success(many));
  await wait();
  doc = dom.window.document;
  assert.equal(doc.querySelector('[data-ws-activity-count]').textContent, '100+');
  assert.match(doc.querySelector('[data-ws-activity-chart-total]').textContent, /^≥ 100/);
  assert.match(doc.querySelector('[data-ws-activity-chart-grid]').getAttribute('aria-label'), /не менее 100/);
  assert.equal(doc.querySelectorAll('[data-ws-activity-item]:not([hidden])').length, 4);
  assert.equal(doc.querySelectorAll('[data-ws-activity-pill]').length, 15, 'the change strip has no duplicate interactive chips');
  const more = doc.querySelector('[data-activity-more]');
  assert.equal(more.hidden, false);
  more.click();
  assert.equal(more.getAttribute('aria-expanded'), 'true');
  assert.equal(doc.querySelectorAll('[data-ws-activity-item]:not([hidden])').length, 15);
  more.click();
  assert.equal(doc.querySelectorAll('[data-ws-activity-item]:not([hidden])').length, 4);
  doc.querySelector('[data-filter="bugfix"]').click();
  assert.equal(more.hidden, true);
  doc.querySelector('[data-filter="all"]').click();
  doc.querySelector('[data-ws-view="kanban"]').click();
  assert.equal(more.hidden, true);
  doc.querySelector('[data-ws-view="feed"]').click();
  assert.equal(more.hidden, false);
  const hundredSnapshot = dom.window.localStorage.getItem(key);
  dom.window.close();

  dom = setup(success(commits), {}, false);
  await wait();
  w = dom.window; doc = w.document;
  w.localStorage.setItem(key, hundredSnapshot);
  w.dispatchEvent(new w.StorageEvent('storage', { key, newValue: hundredSnapshot }));
  await wait();
  assert.equal(doc.querySelector('[data-ws-activity-count]').textContent, '100+', 'a previous number animation must not overwrite a newer total');
  dom.window.close();
  console.log('Activity: cache, reconnect, filters, board persistence and chart limits OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
