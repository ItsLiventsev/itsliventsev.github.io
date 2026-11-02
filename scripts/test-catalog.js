/* Exercise progressive search against the catalog list rendered by the shell. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const code = fs.readFileSync('assets/catalog.js', 'utf8');
(async () => {
  const dom = new JSDOM(`<!doctype html><div data-catalog-search hidden><input><button data-catalog-clear hidden>Очистить</button><p data-catalog-status></p></div>
    <div class="catalog" data-catalog-list>
      <a class="catalog-row" href="#1">Сетевые технологии</a>
      <article class="catalog-row">Архив документов</article>
    </div>`, { runScripts: 'outside-only' });
  const { document, Event } = dom.window;
  dom.window.eval(code);
  const panel = document.querySelector('[data-catalog-search]');
  const input = panel.querySelector('input');
  const status = document.querySelector('[data-catalog-status]');
  const clear = panel.querySelector('button');
  assert.equal(panel.hidden, false);
  input.value = 'СЕТЕВЫЕ'; input.dispatchEvent(new Event('input'));
  const rows = [...document.querySelectorAll('.catalog-row')];
  assert.equal(rows.filter(row => !row.hidden).length, 1);
  assert.equal(status.textContent, 'Найдено: 1');
  document.querySelector('[data-catalog-list]').insertAdjacentHTML('beforeend', '<a class="catalog-row">Сетевые практики</a>');
  await new Promise(resolve => dom.window.setTimeout(resolve, 20));
  assert.equal(status.textContent, 'Найдено: 2');
  input.value = 'отсутствует'; input.dispatchEvent(new Event('input'));
  assert.match(status.textContent, /Ничего не найдено/);
  clear.click();
  assert.equal(input.value, ''); assert.equal(status.textContent, '');
  assert.equal([...document.querySelectorAll('.catalog-row')].filter(row => row.hidden).length, 0);
  assert.equal(document.activeElement, input);
  dom.window.close();
  console.log('Catalog search: filtering, live rows, empty state and clear OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
