/* Optional DOM regression test: NODE_PATH=/path/to/node_modules node scripts/test-search.js (jsdom required). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const script = fs.readFileSync('assets/workspace.js', 'utf8');
const wait = () => new Promise(resolve => setTimeout(resolve, 30));
function setup(fetch) {
  const dom = new JSDOM('<!doctype html><html><head><title>Тест</title></head><body><div class="page-wrap"><main><h1>Тест</h1></main></div></body></html>', { url: 'https://site.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true });
  w.HTMLElement.prototype.scrollIntoView = function() {};
  w.HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
  w.fetch = fetch;
  w.eval(script);
  return dom;
}
function input(w, value) { const input = w.document.querySelector('.ws-search-input'); input.value = value; input.dispatchEvent(new w.Event('input', { bubbles: true })); }
(async () => {
  let dom = setup(async () => ({ ok: true, json: async () => [{ title: 'Сети и практика', url: '/stands/setpolis.html', category: 'Практика', content: 'сети практика' }, { title: 'Сети злоумышленник', url: 'https://evil.test/', category: null, content: 'сети' }] }));
  let w = dom.window, doc = w.document;
  doc.querySelector('.ws-search-trigger').click(); await wait(); input(w, 'сети');
  assert.equal(doc.querySelectorAll('.ws-search-result').length, 1);
  assert.match(doc.querySelector('[data-ws-search-hint]').textContent, /1 из 1/);
  doc.querySelector('[aria-label="Закрыть поиск"]').click();
  assert.equal(doc.querySelector('.ws-search-dialog').open, false);
  assert.equal(w.location.pathname, '/'); // close must not navigate to the selected result
  doc.querySelector('.ws-search-trigger').click();
  assert.match(doc.querySelector('[data-ws-search-hint]').textContent, /1 из 1/);
  input(w, '> go-projects'); assert.equal(doc.querySelectorAll('[data-cmd="go-projects"]').length, 1);
  input(w, '> nonsense тему'); assert.equal(doc.querySelectorAll('[data-cmd]').length, 0); // all terms must match
  w.__wsRecentPages = ['/', '/<img src=x onerror=alert(1)>', '//evil.test/', '/\\evil.test/'];
  input(w, '');
  assert.equal(doc.querySelector('.ws-search-recent img'), null);
  assert.equal(doc.querySelectorAll('.ws-search-recent a').length, 1);
  dom.window.close();

  let calls = 0;
  dom = setup(async () => { calls++; if (calls === 1) return {ok:false}; return {ok:true, json:async()=>[]}; });
  w = dom.window; doc = w.document;
  doc.querySelector('.ws-search-trigger').click(); await wait();
  assert.match(doc.querySelector('.ws-search-results').textContent, /Индекс поиска недоступен/);
  doc.querySelector('[aria-label="Закрыть поиск"]').click();
  doc.querySelector('.ws-search-trigger').click(); await wait();
  assert.equal(calls, 2);
  input(w, '> toggle-theme'); assert.equal(doc.querySelectorAll('[data-cmd="toggle-theme"]').length, 1);
  dom.window.close();
  console.log('Search: close, retry, command matching, recent links and live selection OK');
})().catch(error => { console.error(error, error.stack); process.exitCode = 1; });
