/* Словарь практик: фильтр терминов и тренажёр «проверь себя» на реальной странице.
   Берём stands/glossary.html как есть, снимаем внешние скрипты и исполняем
   assets/glossary.js прямо в jsdom — так тест ловит не только логику,
   но и расхождение разметки с кодом. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const code = fs.readFileSync('assets/glossary.js', 'utf8');
const page = fs.readFileSync('stands/glossary.html', 'utf8').replace(/<script src="[^"]*"[^>]*><\/script>\s*/g, '');

/* Скрипт подключается с defer: в jsdom DOMContentLoaded приходит следующим тиком,
   поэтому ждём его и только потом проверяем разметку. */
async function boot(html, options) {
  const dom = new JSDOM(html, Object.assign({ runScripts: 'outside-only', url: 'https://itsliventsev.github.io/stands/glossary.html' }, options));
  dom.window.eval(code);
  await new Promise(resolve => dom.window.setTimeout(resolve, 30));
  return dom;
}

function click(window, node) {
  node.dispatchEvent(new window.Event('click', { bubbles: true }));
}

function press(window, node, key) {
  node.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

(async () => {
  const dom = await boot(page);
  const { window } = dom;
  const { document } = window;
  const zone = document.querySelector('[data-drill-zone]');
  const trigger = document.querySelector('[data-drill-open]');
  const panel = document.querySelector('[data-drill]');
  const optionsBox = panel.querySelector('[data-drill-options]');
  const verdict = panel.querySelector('[data-drill-verdict]');
  const term = panel.querySelector('[data-drill-term]');
  const count = panel.querySelector('[data-drill-count]');
  const next = panel.querySelector('[data-drill-next]');
  const again = panel.querySelector('[data-drill-again]');
  const close = panel.querySelector('[data-drill-close]');
  const dots = panel.querySelector('[data-drill-dots]');

  /* Без JS тренажёр не мозолит глаза: зона и кнопка приходят скрытыми. */
  assert.equal(zone.hasAttribute('hidden'), false, 'зона тренажёра открывается скриптом');
  assert.equal(trigger.hidden, false, 'кнопка тренажёра появилась');
  assert.equal(panel.hidden, true, 'панель скрыта до запуска');

  click(window, trigger);
  assert.equal(panel.hidden, false, 'панель открылась');
  assert.equal(count.textContent, '1 / 10', 'первый вопрос из десяти');
  assert.equal(dots.querySelectorAll('[data-dot]').length, 10, 'десять точек прогресса');
  assert.equal(dots.querySelector('[data-state="now"]') !== null, true, 'текущая точка помечена');

  const firstTerm = term.textContent.trim();
  assert.ok(firstTerm.length > 0, 'термин виден');
  assert.ok(term.getAttribute('data-universe'), 'у термина есть подпись раздела или вселенной');

  const options = () => [...optionsBox.querySelectorAll('[data-drill-option]')];
  assert.equal(options().length, 4, 'четыре варианта определения');
  const texts = options().map(option => option.querySelector('.gl-drill-def').textContent);
  assert.equal(new Set(texts).size, 4, 'варианты не повторяются');
  assert.equal(options().filter(option => option.getAttribute('data-correct') === 'true').length, 1, 'верный вариант ровно один');
  assert.ok(texts.every(text => text.length > 12), 'определения содержательные');

  /* Верный ответ есть в словаре: берём его из разметки страницы. */
  const sourceDefs = [...document.querySelectorAll('.glossary-item dd')].map(dd => dd.textContent.replace(/\s+/g, ' ').trim());
  assert.ok(texts.every(text => sourceDefs.some(def => def === text || def.startsWith(text.replace(/…$/, '')))), 'варианты пришли из словаря');

  const right = options().find(option => option.getAttribute('data-correct') === 'true');
  const wrong = options().find(option => option !== right);
  click(window, wrong);
  assert.equal(wrong.getAttribute('data-state'), 'wrong', 'промах помечен');
  assert.equal(right.getAttribute('data-state'), 'right', 'верный вариант подсвечен');
  assert.match(verdict.textContent, /^мимо\./, 'промах объясняется');
  assert.ok(verdict.textContent.includes(firstTerm), 'в разборе назван термин');
  assert.equal(next.hidden, false, 'доступен следующий вопрос');

  /* Второй вариант по промаху не переигрывается. */
  click(window, right);
  assert.match(verdict.textContent, /^мимо\./, 'повторный клик ничего не меняет');

  click(window, next);
  assert.equal(count.textContent, '2 / 10', 'счётчик перешёл дальше');
  assert.equal(verdict.textContent, 'выберите верное определение', 'разбор сброшен');
  assert.equal(options().filter(option => option.getAttribute('data-state')).length, 0, 'новая четвёрка без подсветки');

  /* Клавиша 1 отвечает за первый вариант — так десять вопросов проходятся быстрее. */
  press(window, panel, '1');
  assert.ok(options()[0].getAttribute('data-state'), 'цифра выбрала вариант');
  assert.equal(dots.querySelectorAll('[data-state="done"]').length, 1, 'первый шаг закрашен');
  assert.equal(dots.querySelectorAll('[data-state="now"]').length, 1, 'текущий шаг один');

  /* Доходим до конца раунда: счёт, лучший результат, повтор. */
  let guard = 0;
  while (guard++ < 40) {
    if (!next.hidden) { click(window, next); continue; }
    const left = optionsBox.querySelectorAll('[data-drill-option]');
    if (!left.length) break;
    click(window, left[0]);
  }
  assert.equal(again.hidden, false, 'раунд закрылся');
  assert.equal(term.textContent, 'круг закрыт', 'итог вместо термина');
  assert.match(verdict.textContent, /из 10/, 'в итоге есть счёт');
  const saved = JSON.parse(window.localStorage.getItem('itsliventsev-drill-v1'));
  assert.ok(saved && typeof saved.right === 'number' && saved.total === 10, 'лучший результат сохранён');
  assert.ok(panel.querySelector('[data-drill-best]').textContent.includes('лучший результат'), 'итог показывает рекорд');

  click(window, again);
  assert.equal(count.textContent, '1 / 10', 'новый раунд начинается сначала');
  assert.equal(options().length, 4, 'варианты пересобраны');

  press(window, panel, 'Escape');
  assert.equal(panel.hidden, true, 'Escape закрывает тренажёр');
  assert.equal(document.activeElement, trigger, 'фокус вернулся на кнопку');
  click(window, trigger);
  assert.equal(panel.hidden, false, 'тренажёр открывается снова');
  click(window, close);
  assert.equal(panel.hidden, true, 'крестик тоже закрывает');

  /* Фильтр живёт в том же файле — проверяем, что переезд из инлайна ничего не сломал. */
  const input = document.getElementById('glossary-search');
  const status = document.getElementById('glossary-status');
  const empty = document.getElementById('glossary-empty');
  const items = [...document.querySelectorAll('.glossary-item')];
  input.value = 'SLA';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  const shown = items.filter(item => !item.hidden);
  assert.ok(shown.length > 0 && shown.length < items.length, 'поиск оставил часть терминов');
  assert.match(status.textContent, new RegExp('найдено: ' + shown.length + ' из ' + items.length), 'статус называет число совпадений');
  assert.equal(empty.hidden, true, 'заглушка при находках скрыта');
  input.value = 'ппппппп';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(empty.hidden, false, 'на бессмыслице показывается заглушка');
  const filters = [...document.querySelectorAll('[data-ws-glossary-filter]')];
  click(window, filters.find(button => button.getAttribute('data-ws-glossary-filter') === 'ДатаПолис'));
  assert.equal(filters.find(button => button.getAttribute('data-ws-glossary-filter') === 'ДатаПолис').getAttribute('aria-pressed'), 'true', 'фильтр вселенной включился');
  assert.equal(filters[0].getAttribute('aria-pressed'), 'false', 'остальные фильтры сняты');
  dom.window.close();

  /* Слишком короткий словарь: тренажёр не включается, чтобы не выбирать один вариант из двух. */
  const tiny = await boot('<!doctype html><body><div class="glossary-toolbar"><input id="glossary-search"></div>' +
    '<div data-drill-zone hidden><button data-drill-open hidden>тренажёр</button></div>' +
    '<div data-drill hidden><span data-drill-count></span><span data-drill-dots></span><p data-drill-term></p>' +
    '<div data-drill-options></div><p data-drill-verdict></p><button data-drill-next></button>' +
    '<button data-drill-again></button><span data-drill-best></span><button data-drill-close></button></div>' +
    '<dl class="glossary-grid"><div class="glossary-item"><dt>раз</dt><dd>первый</dd></div>' +
    '<div class="glossary-item"><dt>два</dt><dd>второй</dd></div></dl></body>');
  assert.equal(tiny.window.document.querySelector('[data-drill-zone]').hidden, true, 'на трёх терминах тренажёр не предлагается');
  assert.equal(tiny.window.document.querySelector('[data-drill-open]').hidden, true, 'кнопка осталась скрытой');
  tiny.window.close();

  console.log('Glossary: drill round, разбор ответов, клавиши, рекорд и фильтр OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
