/* Optional DOM regression test: NODE_PATH=/path/to/node_modules node scripts/test-search.js (jsdom required). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const shell = fs.readFileSync('assets/shell.js', 'utf8');
const wait = () => new Promise(resolve => setTimeout(resolve, 40));
function setup(fetch) {
  const dom = new JSDOM('<!doctype html><html lang="ru"><head><title>Тест</title></head><body><main id="main-content"><h1>Тест</h1><h2 id="a">Раздел</h2><p>текст</p></main></body></html>', { url: 'https://site.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
  w.requestAnimationFrame = cb => setTimeout(cb, 0);
  w.fetch = fetch;
  w.eval(shell);
  return dom;
}
function input(w, value) {
  const field = w.document.querySelector('.ui-search-input');
  field.value = value;
  field.dispatchEvent(new w.Event('input', { bubbles: true }));
}
(async () => {
  let dom = setup(async () => ({ ok: true, json: async () => [
    { title: 'Сети и практика', url: '/stands/setpolis.html', category: 'Практика', content: 'сети практика' },
    { title: 'Сети злоумышленник', url: 'https://evil.test/', category: null, content: 'сети' }
  ] }));
  let w = dom.window, doc = w.document;
  assert(doc.querySelector('.ui-search-open'), 'кнопка поиска должна быть в шапке');
  doc.querySelector('.ui-search-open').click(); await wait();
  input(w, 'сети');
  assert.equal(doc.querySelectorAll('.ui-search-result').length, 1);
  assert.equal(doc.querySelectorAll('.ui-search-result a, a.ui-search-result').length <= 1, true);
  assert(/сети/i.test(doc.querySelector('.ui-search-results').textContent));
  input(w, '> go-projects');
  assert.equal(doc.querySelectorAll('[data-cmd="go-projects"]').length, 1);
  input(w, '> nonsense тему');
  assert.equal(doc.querySelectorAll('[data-cmd]').length, 0);
  dom.window.close();

  let calls = 0;
  dom = setup(async () => { calls++; return calls === 1 ? { ok: false } : { ok: true, json: async () => [] }; });
  w = dom.window; doc = w.document;
  doc.querySelector('.ui-search-open').click(); await wait();
  assert.match(doc.querySelector('.ui-search-results').textContent, /Индекс недоступен/);
  input(w, '> toggle-theme');
  assert.equal(doc.querySelectorAll('[data-cmd="toggle-theme"]').length, 1);
  dom.window.close();
  console.log('Search: open, results, commands, retry and index fallback OK');
})().catch(error => { console.error(error, error.stack); process.exitCode = 1; });
