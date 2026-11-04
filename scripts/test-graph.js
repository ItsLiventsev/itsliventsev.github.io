/*
 * Граф связей: заметки и стенды на одном поле.
 *
 * Страница статическая (никакого fetch), поэтому проверка целиком идёт в jsdom
 * без сервера: читаем blog/graph.html, выполняем assets/knowledge.js и смотрим,
 * что кнопки фильтра и статус ведут себя так, как обещает AGENTS.md, п. 8.
 *
 * Главное, что здесь ловится, — расхождение графа с assets/data/topics.json:
 * узлы-стенды и мосты «заметка ↔ стенд» обязаны приходить из того же файла,
 * что кормит блоки RELATED на страницах заметок и стендов.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const topics = JSON.parse(read('assets/data/topics.json'));
const practices = [...new Set(topics.pairs.map((pair) => pair.practice))].sort();
const html = read('blog/graph.html');
const code = read('assets/knowledge.js');

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const document = window.document;
window.eval(code);

const nodes = [...document.querySelectorAll('.kn-node')];
const stands = nodes.filter((node) => node.dataset.kind === 'stand');
const notes = nodes.filter((node) => node.dataset.kind !== 'stand');
const lines = [...document.querySelectorAll('.kn-graph-svg line')];
const status = document.querySelector('[data-graph-status]');
const shown = () => nodes.filter((node) => !node.hidden);
const shownNotes = () => shown().filter((node) => node.dataset.kind !== 'stand');
const shownStands = () => shown().filter((node) => node.dataset.kind === 'stand');
const click = (zone) => {
  const chip = document.querySelector('[data-graph-zone="' + zone + '"]');
  assert(chip, 'нет кнопки фильтра: ' + zone);
  chip.dispatchEvent(new window.Event('click', { bubbles: true }));
  return chip;
};

/* 1. Состав поля совпадает с данными. */
assert.equal(stands.length, practices.length, 'узлов-стендов ' + stands.length + ', а в topics.json их ' + practices.length);
assert(notes.length > 0, 'на графе нет заметок');
assert.equal(nodes.length, notes.length + stands.length);
assert(lines.length >= topics.pairs.length, 'мостов меньше, чем пар в topics.json');
assert.equal(new Set(nodes.map((node) => node.dataset.node)).size, nodes.length, 'id узлов должны быть уникальны');

/* 2. Без фильтра видны все, статус честный. */
assert.equal(shown().length, nodes.length, 'по умолчанию видны все узлы');
assert.match(status.textContent, /Показаны все узлы: \d+/);
assert.match(status.textContent, new RegExp(stands.length + ' (стенд|стенда|стендов)'));

/* 3. Кнопка «стенды» оставляет только их. */
const standsChip = click('stands');
assert.equal(shownNotes().length, 0, 'при фильтре «стенды» заметки скрыты');
assert.equal(shownStands().length, stands.length, 'при фильтре «стенды» видны все стенды');
assert.equal(standsChip.getAttribute('aria-pressed'), 'true');
assert.match(status.textContent, /^Стенды: /);

/* 4. Рубрика держит свои заметки и стенды своих тем. */
click('linux');
const rubricNotes = shownNotes();
const rubricStands = shownStands();
assert(rubricNotes.length > 0, 'рубрика не оставила ни одной заметки');
assert(rubricNotes.every((node) => node.dataset.zone === 'linux'), 'в рубрике остались чужие заметки');
assert(rubricStands.length > 0, 'вместе с рубрикой не осталось ни одного стенда');
assert(rubricStands.length < stands.length, 'фильтр по рубрике не сузил стенды');
assert.match(status.textContent, /Рубрика: \d+ узл/);

/* Стенд остаётся только тогда, когда видна хотя бы одна его тема. */
const visibleIds = new Set(shown().map((node) => node.dataset.node));
for (const stand of rubricStands) {
  const links = lines.filter((line) => line.dataset.from === stand.dataset.node || line.dataset.to === stand.dataset.node);
  assert(links.some((line) => visibleIds.has(line.dataset.from) || visibleIds.has(line.dataset.to)),
    'стенд ' + stand.dataset.node + ' остался без видимой темы');
}

/* 5. «Все» возвращает поле целиком и снимает нажатие с прежнего чипа. */
const allChip = click('all');
assert.equal(shown().length, nodes.length, 'сброс фильтра возвращает все узлы');
assert.equal(allChip.getAttribute('aria-pressed'), 'true');
assert.equal(standsChip.getAttribute('aria-pressed'), 'false');

/* 6. Стенды — ссылки на настоящие страницы, а не заглушки. */
for (const stand of stands) {
  const href = stand.getAttribute('href');
  assert(href && href.startsWith('/stands/'), 'узел-стенд без ссылки на стенд: ' + stand.dataset.node);
  assert(fs.existsSync(path.join(ROOT, href.slice(1))), 'узел-стенд ведёт на несуществующую страницу: ' + href);
  assert(stand.textContent.trim().length > 0, 'у узла-стенда нет доступного имени');
}

window.close();
console.log('Graph: ' + notes.length + ' заметок + ' + stands.length + ' стендов, '
  + lines.length + ' связей; фильтры «стенды» и по рубрике держат мост «теория ↔ практика»');
