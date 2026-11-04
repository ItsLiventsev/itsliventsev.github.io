/* Общий рендер моста «теория ↔ практика».
 *
 * Одна таблица связей (assets/data/topics.json) → два вида блока:
 * на заметке «Практика по теме», на стенде «Теория по теме».
 *
 * Модуль используют двое:
 *   scripts/build-knowledge.js — генерирует заметки, поэтому блок вставляет он;
 *   scripts/build-related.js   — добивает стенды и пересобирает заметки, если
 *                                их правили руками или связь изменилась.
 * Пока рендер один, обе стороны всегда совпадают, и `--check` не «мигает».
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG = 'assets/data/topics.json';
const START = '<!-- RELATED:START -->';
const END = '<!-- RELATED:END -->';
const NOTE_INDENT = '      ';
const PRACTICE_INDENT = '    ';
const NOTE_ANCHOR = /\n([ \t]*)<nav class="kn-pager"/;
const PRACTICE_ANCHOR = /\n([ \t]*)<div id="lab-root"/;
const PRACTICE_FALLBACK = /\n([ \t]*)<\/main>/;

const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BLOCK_RE = new RegExp('\\n[ \\t]*' + escapeRe(START) + '[\\s\\S]*?' + escapeRe(END) + '[ \\t]*(?=\\n)');

let cache = null;

function load() {
  if (cache) return cache;
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, CONFIG), 'utf8'));
  const byNote = new Map();
  const byPractice = new Map();
  for (const pair of config.pairs || []) {
    if (!byNote.has(pair.note)) byNote.set(pair.note, []);
    byNote.get(pair.note).push(pair.practice);
    if (!byPractice.has(pair.practice)) byPractice.set(pair.practice, []);
    byPractice.get(pair.practice).push(pair.note);
  }
  cache = { pairs: (config.pairs || []).length, byNote, byPractice };
  return cache;
}

const titles = new Map();
function h1Of(file) {
  if (titles.has(file)) return titles.get(file);
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const match = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(source);
  const title = match ? match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
  titles.set(file, title);
  return title;
}

function areaOf(practice) {
  if (practice.startsWith('stands/office/')) return 'ОфисПолис';
  if (practice.startsWith('stands/ops/')) return 'ДатаПолис';
  return 'СетьПолис';
}

function plural(count, one, few, many) {
  const rest10 = count % 10;
  const rest100 = count % 100;
  const word = rest10 === 1 && rest100 !== 11 ? one
    : rest10 >= 2 && rest10 <= 4 && (rest100 < 12 || rest100 > 14) ? few
    : many;
  return count + ' ' + word;
}

function markup(id, heading, counter, rows, indent) {
  const items = rows.map(row => indent + '  <li><a class="rel-item" href="' + row.href + '">'
    + '<span class="rel-area">' + row.area + '</span>'
    + '<span class="rel-title">' + row.title + '</span>'
    + '<span class="rel-go" aria-hidden="true">→</span>'
    + '</a></li>');
  return [
    indent + START,
    indent + '<aside class="rel-block" aria-labelledby="' + id + '">',
    indent + '  <div class="rel-head"><h2 id="' + id + '">' + heading + '</h2><span>' + counter + '</span></div>',
    indent + '  <ul class="rel-list">',
    ...items,
    indent + '  </ul>',
    indent + '</aside>',
    indent + END,
  ].join('\n');
}

/* Блоки строятся без завершающего перевода строки: вставкой занимаются
   stripBlock/вставка в шаблоне, иначе легко получить двойную пустую строку. */
function noteBlockMarkup(slug) {
  const practices = load().byNote.get(slug);
  if (!practices) return '';
  return markup('rel-practice', 'Практика по теме',
    plural(practices.length, 'стенд', 'стенда', 'стендов'),
    practices.map(practice => ({ href: '/' + practice, area: areaOf(practice), title: h1Of(practice) })),
    NOTE_INDENT);
}

function practiceBlockMarkup(file) {
  const notes = load().byPractice.get(file);
  if (!notes) return '';
  return markup('rel-theory', 'Теория по теме',
    plural(notes.length, 'заметка', 'заметки', 'заметок'),
    notes.map(slug => ({ href: '/blog/' + slug + '.html', area: 'База знаний', title: h1Of('blog/' + slug + '.html') })),
    PRACTICE_INDENT);
}

const stripBlock = source => source.replace(BLOCK_RE, '');

function insert(source, blockMarkup, anchor, fallback) {
  const cleaned = stripBlock(source);
  const regex = fallback && !anchor.test(cleaned) ? fallback : anchor;
  const match = regex.exec(cleaned);
  if (!match) return null;
  return cleaned.slice(0, match.index) + '\n' + blockMarkup + cleaned.slice(match.index);
}

/* Нет связей — блока нет: снимаем прежний, но пустую строку не оставляем. */
const withNoteBlock = (source, slug) => {
  const markup = noteBlockMarkup(slug);
  return markup ? insert(source, markup, NOTE_ANCHOR) ?? source : stripBlock(source);
};
const withPracticeBlock = (source, file) => {
  const markup = practiceBlockMarkup(file);
  return markup ? insert(source, markup, PRACTICE_ANCHOR, PRACTICE_FALLBACK) ?? source : stripBlock(source);
};

module.exports = {
  CONFIG, START, END, ROOT,
  load, h1Of, noteBlockMarkup, practiceBlockMarkup, stripBlock, withNoteBlock, withPracticeBlock,
};
