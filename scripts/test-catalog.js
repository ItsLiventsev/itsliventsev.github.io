/* Exercise progressive search against the catalog list rendered by the shell. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const code = fs.readFileSync('assets/catalog.js', 'utf8');
(async () => {
  const dom = new JSDOM(`<!doctype html><div data-catalog-search hidden><input><button data-catalog-clear hidden>Очистить</button><p data-catalog-status></p></div>
    <div class="catalog" data-catalog-list>
      <a class="catalog-row" data-catalog-tags="network" href="#1">Сетевые технологии</a>
      <article class="catalog-row" data-catalog-tags="archive">Архив документов</article>
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
  document.querySelector('[data-catalog-list]').insertAdjacentHTML('beforeend', '<a class="catalog-row" data-catalog-tags="network">Сетевые практики</a>');
  await new Promise(resolve => dom.window.setTimeout(resolve, 20));
  assert.equal(status.textContent, 'Найдено: 2');
  input.value = 'отсутствует'; input.dispatchEvent(new Event('input'));
  assert.match(status.textContent, /Ничего не найдено/);
  clear.click();
  assert.equal(input.value, ''); assert.equal(status.textContent, '');
  assert.equal([...document.querySelectorAll('.catalog-row')].filter(row => row.hidden).length, 0);
  assert.equal(document.activeElement, input);

  /* ——— фильтр по рубрике: тот же контракт, что у «Статей» и «Заметок» ——— */
  const list = document.querySelector('[data-catalog-list]');
  document.querySelector('[data-catalog-search]').insertAdjacentHTML(
    'beforebegin',
    '<div class="catalog-filters"><button class="catalog-filter" type="button" aria-pressed="true" data-catalog-filter="all">Все</button>'
    + '<button class="catalog-filter" type="button" aria-pressed="false" data-catalog-filter="archive">Архив</button></div>'
    + '<p class="catalog-status" data-catalog-status role="status"></p>'
  );
  dom.window.close();

  const second = new JSDOM(`<!doctype html>
    <div data-catalog-search hidden><input><button data-catalog-clear hidden>Очистить</button></div>
    <div class="catalog-filters">
      <button class="catalog-filter" type="button" aria-pressed="true" data-catalog-filter="all">Все</button>
      <button class="catalog-filter" type="button" aria-pressed="false" data-catalog-filter="archive">Архив</button>
    </div>
    <p data-catalog-status role="status"></p>
    <p data-catalog-empty hidden>Под этот фильтр ничего нет</p>
    <div class="catalog" data-catalog-list>
      <a class="catalog-row" data-catalog-tags="network">Сетевые технологии</a>
      <a class="catalog-row" data-catalog-tags="archive">Архив документов</a>
      <a class="catalog-row" data-catalog-tags="archive">Архив программ</a>
    </div>`, { runScripts: 'outside-only' });
  const doc2 = second.window.document;
  second.window.eval(code);
  const chip = doc2.querySelector('[data-catalog-filter="archive"]');
  chip.dispatchEvent(new second.window.Event('click'));
  const rows2 = [...doc2.querySelectorAll('.catalog-row')];
  assert.equal(rows2.filter(row => !row.hidden).length, 2, 'чип оставляет только свои элементы');
  assert.equal(chip.getAttribute('aria-pressed'), 'true', 'выбранный чип нажат');
  assert.equal(doc2.querySelector('[data-catalog-filter="all"]').getAttribute('aria-pressed'), 'false');
  assert.equal(doc2.querySelector('[data-catalog-status]').textContent, 'Найдено: 2');
  assert.equal(doc2.querySelector('[data-catalog-empty]').hidden, true, 'заглушка спрятана, пока есть что показать');

  /* фильтр и поиск складываются */
  const field2 = doc2.querySelector('input');
  field2.value = 'программ';
  field2.dispatchEvent(new second.window.Event('input'));
  assert.equal([...doc2.querySelectorAll('.catalog-row')].filter(row => !row.hidden).length, 1, 'поиск сужает фильтр');

  /* пустой результат: заглушка видна, статус честный */
  field2.value = 'нет такого';
  field2.dispatchEvent(new second.window.Event('input'));
  assert.equal(doc2.querySelector('[data-catalog-empty]').hidden, false);
  assert.match(doc2.querySelector('[data-catalog-status]').textContent, /Ничего не найдено/);

  doc2.querySelector('[data-catalog-filter="all"]').dispatchEvent(new second.window.Event('click'));
  doc2.querySelector('[data-catalog-clear]').dispatchEvent(new second.window.Event('click'));
  assert.equal([...doc2.querySelectorAll('.catalog-row')].filter(row => row.hidden).length, 0, 'сброс возвращает весь список');
  second.window.close();

  console.log('Catalog: search, tag filter, combined filtering, empty state and reset OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
