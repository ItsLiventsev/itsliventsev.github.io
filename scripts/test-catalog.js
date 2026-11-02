/* Exercise search against static cards and lists replaced by existing category filters. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const code = fs.readFileSync('assets/catalog.js', 'utf8');
(async () => {
  const dom = new JSDOM(`<!doctype html><div data-catalog-search hidden><input><button data-catalog-clear hidden>Очистить</button><p data-catalog-status></p></div><div class="ws-project-grid"><a class="ws-project-card">Сетевые технологии</a><article class="ws-project-card">Архив документов</article></div><div id="pub-list"></div>`, { runScripts: 'outside-only' });
  const { document, Event } = dom.window;
  dom.window.eval(code);
  const panel = document.querySelector('[data-catalog-search]');
  const input = panel.querySelector('input');
  const status = panel.querySelector('[data-catalog-status]');
  const clear = panel.querySelector('button');
  assert.equal(panel.hidden, false);
  input.value = 'СЕТЕВЫЕ'; input.dispatchEvent(new Event('input'));
  assert.equal(document.querySelectorAll('.catalog-filtered-out').length, 1);
  assert.equal(status.textContent, 'Найдено: 1');
  document.querySelector('#pub-list').innerHTML = '<a class="ws-publication-row">Сетевые практики</a>';
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(status.textContent, 'Найдено: 2');
  input.value = 'отсутствует'; input.dispatchEvent(new Event('input'));
  assert.match(status.textContent, /Ничего не найдено/);
  clear.click();
  assert.equal(input.value, ''); assert.equal(status.textContent, '');
  assert.equal(document.querySelectorAll('.catalog-filtered-out').length, 0);
  assert.equal(document.activeElement, input);
  dom.window.close();
  console.log('Catalog search: static, dynamic, empty and clear states OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
