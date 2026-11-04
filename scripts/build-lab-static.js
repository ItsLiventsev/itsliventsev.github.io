#!/usr/bin/env node
/* ==========================================================================
   Статический контент учебных работ: node scripts/build-lab-static.js

   Зачем. Теория, задачи, контрольный тест и ситуационная задача каждой
   работы лежат во встроенном JSON (#lab-data / #ops-data / #office-data) и
   рисуются движком в браузере. Для робота страница выглядела как пустой
   каркас: в среднем 81 слово видимого текста на 51 работе, а поисковый трафик
   по «как настроить …» уходил конкурентам. Пользователю при этом хуже не
   становится — движок всё равно строит интерактив.

   Как. Скрипт читает JSON из страницы и вписывает между маркерами
   LAB:STATIC:START / LAB:STATIC:END разметку для чтения и индексации:
   бриф, теория, шпаргалка, бэклог задач, ситуационная задача (или тикет),
   runbook, контрольный тест в <details> и рефлексия. Интерактив остаётся
   прежним: движки при старте заменяют содержимое контейнера целиком.

   --check (CI) ничего не пишет и падает, если страница разошлась с JSON:
   иначе правка JSON тихо оставит в индексе устаревший текст.

   Запуск: node scripts/build-lab-static.js [--check]
   ========================================================================== */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const START = '<!-- LAB:STATIC:START -->';
const END = '<!-- LAB:STATIC:END -->';

/* Контейнер интерактива и имя JSON-острова для каждого движка. */
const KITS = [
  { data: 'lab-data', root: 'lab-root', engine: 'lab', file: 'assets/lab-kit.js' },
  { data: 'ops-data', root: 'ops-root', engine: 'ops', file: 'assets/ops-kit.js' },
  { data: 'office-data', root: 'office-root', engine: 'office', file: 'assets/office-kit.js' },
];

const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* Текст из JSON может содержать простую разметку (<code>, <strong>) —
   она авторская и полезная, поэтому оставляем известные теги, остальное
   экранируем. Так в страницу не попадёт произвольный HTML из чужого файла. */
const ALLOWED = /^<\/?(code|strong|em|b|i|br|span|sub|sup)\b[^>]*>$/i;
function rich(value) {
  return String(value == null ? '' : value).split(/(<[^>]+>)/).map((chunk) => {
    if (!chunk) return '';
    if (chunk.startsWith('<') && ALLOWED.test(chunk)) return chunk;
    return esc(chunk);
  }).join('');
}

const list = (value) => (Array.isArray(value) ? value : []);
const text = (value) => (typeof value === 'string' ? value.trim() : '');

function section(id, title, badge, body) {
  if (!body) return '';
  return '\n<section class="lab-panel lab-static-section" id="' + id + '">' +
    '<div class="lp-head"><h2>' + esc(title) + '</h2>' +
    (badge ? '<span class="flat-badge">' + esc(badge) + '</span>' : '') + '</div>' +
    '<div class="lp-body">' + body + '</div></section>';
}

function brief(cfg) {
  if (!text(cfg.story)) return '';
  const who = text(cfg.who);
  return '<p class="lab-static-who">' + (who ? '<strong>' + esc(who) + '</strong> · ' : '') +
    'бриф практики</p><p>' + rich(cfg.story) + '</p>';
}

function theory(cfg) {
  const blocks = list(cfg.theory);
  if (!blocks.length) return '';
  return blocks.map((block, index) => {
    const body = '<article class="theory-block">' +
      '<h3><span class="theory-num">' + String(index + 1).padStart(2, '0') + '</span> ' +
      esc(text(block.h)) + '</h3>' +
      (text(block.p) ? '<p>' + rich(block.p) + '</p>' : '') +
      (text(block.code) ? '<pre class="lab-codeblock"><code>' + esc(block.code) + '</code></pre>' : '') +
      (text(block.note) ? '<p class="lab-note">⚑ ' + esc(block.note) + '</p>' : '') +
      '</article>';
    return body;
  }).join('');
}

function commands(cfg, engine) {
  const rows = list(cfg.commands).filter((row) => row && (row.cisco || row.linux || row.lo || row.ms));
  if (!rows.length) return '';
  const pair = engine === 'office'
    ? ['LibreOffice', 'Microsoft Office']
    : ['Cisco IOS', 'Linux / ALT'];
  const cells = rows.map((row) => '<tr><td><code>' + esc(row.cisco || row.lo || '—') + '</code></td>' +
    '<td><code>' + esc(row.linux || row.ms || '—') + '</code></td>' +
    '<td>' + rich(row.what || '') + '</td></tr>').join('');
  return '<div class="lab-static-tablewrap"><table class="lab-static-table"><caption>Шпаргалка команд и элементов интерфейса</caption>' +
    '<thead><tr><th scope="col">' + pair[0] + '</th><th scope="col">' + pair[1] + '</th>' +
    '<th scope="col">Что делает</th></tr></thead><tbody>' + cells + '</tbody></table></div>';
}

function reference(cfg) {
  const rows = list(cfg.reference);
  if (!rows.length) return '';
  return '<div class="lab-static-tablewrap"><table class="lab-static-table"><thead><tr>' +
    '<th scope="col">LibreOffice</th><th scope="col">Microsoft Office</th><th scope="col">Назначение</th>' +
    '</tr></thead><tbody>' + rows.map((row) => '<tr><td><code>' + esc(row.lo || '—') + '</code></td>' +
      '<td><code>' + esc(row.ms || '—') + '</code></td><td>' + rich(row.what || '') + '</td></tr>').join('') +
    '</tbody></table></div>';
}

function tasks(cfg) {
  const items = list(cfg.tasks);
  if (!items.length) return '';
  return '<ol class="lab-static-tasks">' + items.map((task) =>
    '<li>' + rich(task.text || task) + '</li>').join('') + '</ol>' +
    '<p class="admin-hint">Задача считается выполненной после реальной работы на оборудовании, ' +
    'в эмуляторе или на виртуальной машине. В интерактиве чек-лист сохраняет прогресс.</p>';
}

function situational(cfg) {
  const item = cfg.situational;
  if (!item) return '';
  return '<p><strong>' + esc(text(item.title) || 'Ситуационная задача') + '.</strong> ' +
    rich(item.text || '') + '</p>' +
    (list(item.deliverables).length ? '<p>Что сдать:</p><ul>' +
      list(item.deliverables).map((d) => '<li>' + rich(d) + '</li>').join('') + '</ul>' : '');
}

function ticket(cfg) {
  const item = cfg.ticket;
  if (!item) return '';
  return '<p><strong>' + esc(text(item.title)) + '</strong></p>' +
    '<p class="lab-static-meta">тип: ' + esc(text(item.type) || '—') +
    ' · приоритет: ' + esc(text(item.priority) || '—') + '</p>' +
    '<p>' + rich(item.text || '') + '</p>' +
    (list(item.deliverables).length ? '<p>Что сдать:</p><ul>' +
      list(item.deliverables).map((d) => '<li>' + rich(d) + '</li>').join('') + '</ul>' : '');
}

function runbook(cfg) {
  const item = cfg.runbook;
  if (!item || !list(item.steps).length) return '';
  return '<p><strong>' + esc(text(item.title) || 'Runbook') + '</strong></p><ol>' +
    list(item.steps).map((step) => '<li>' + rich(step) + '</li>').join('') + '</ol>';
}

/* Тест в статике — раскрывающиеся блоки: вопрос виден, ответ по клику.
   Так страница не «сдаёт» ответы в сниппете, но робот читает и вопрос,
   и пояснение. */
function quiz(cfg) {
  const items = list(cfg.quiz);
  if (!items.length) return '';
  return items.map((item, index) => {
    const correct = Number(item.answer);
    const answer = list(item.options)[correct];
    return '<details class="lab-static-quiz"><summary>Вопрос ' + (index + 1) + '. ' +
      esc(text(item.q)) + '</summary>' +
      (list(item.options).length ? '<ul>' + list(item.options).map((option, i) =>
        '<li>' + rich(option) + (i === correct ? ' <span class="flat-badge is-run">верно</span>' : '') +
        '</li>').join('') + '</ul>' : '') +
      (answer ? '<p><strong>Ответ:</strong> ' + rich(answer) + '</p>' : '') +
      (text(item.explain) ? '<p>' + rich(item.explain) + '</p>' : '') +
      '</details>';
  }).join('');
}

function reflection(cfg) {
  const items = list(cfg.reflection);
  if (!items.length) return '';
  return '<ul class="lab-static-reflection">' + items.map((item) =>
    '<li>' + rich(item) + '</li>').join('') + '</ul>';
}

function readOnlyNote(cfg, engine) {
  const hub = engine === 'ops' ? 'index.html' : engine === 'office' ? 'index.html' : 'setpolis.html';
  const label = engine === 'ops' ? 'консоль сервисного центра'
    : engine === 'office' ? 'кабинет бюро' : 'кабинет СетьПолиса';
  return '\n<p class="lab-static-note" data-lab-readonly-note hidden><strong>Режим чтения.</strong> ' +
    'Текст работы доступен без профиля, а прогресс, автотесты и сдача появляются после входа: ' +
    '<a href="' + hub + '?return=' + encodeURIComponent(cfg.id + '.html') + '">' + label + '</a>.</p>';
}

function articleRoot(cfg, engine) {
  const badge = [];
  if (text(cfg.sprintTitle)) badge.push('спринт ' + esc(cfg.sprint) + ' · ' + esc(cfg.sprintTitle));
  if (text(cfg.hours)) badge.push(esc(cfg.hours));
  if (text(cfg.coins)) badge.push(esc(cfg.coins) + ' неткоинов');
  const heading = '<header class="lab-static-head"><h2>О работе</h2>' +
    (badge.length ? '<p class="lab-static-meta">' + badge.join(' · ') + '</p>' : '') +
    (text(cfg.lead) ? '<p class="lab-static-lead">' + rich(cfg.lead) + '</p>' : '') +
    '</header>';
  return '<article class="lab-static" data-lab-static>' + heading +
    section('lab-static-brief', 'Бриф практики', '', brief(cfg)) +
    section('lab-static-theory', 'Теория', 'опорный конспект', theory(cfg)) +
    section('lab-static-commands', 'Шпаргалка', 'команды', commands(cfg, engine) + reference(cfg)) +
    section('lab-static-tasks', 'Бэклог задач', 'чек-лист', tasks(cfg)) +
    section('lab-static-situation', 'Ситуационная задача', '', situational(cfg)) +
    section('lab-static-ticket', 'Заявка', text(cfg.ticket && cfg.ticket.priority), ticket(cfg)) +
    section('lab-static-runbook', 'Runbook', '', runbook(cfg)) +
    section('lab-static-quiz', 'Проверь себя', 'контрольный тест', quiz(cfg)) +
    section('lab-static-reflection', 'Рефлексия', '', reflection(cfg)) +
    readOnlyNote(cfg, engine) +
    '</article>';
}

function pages() {
  const acc = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = dir === '.' ? entry.name : dir + '/' + entry.name;
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'assets') walk(rel);
      } else if (entry.name.endsWith('.html')) acc.push(rel);
    }
  }('.'));
  return acc;
}

const pending = [];
let touched = 0;
let words = 0;

for (const rel of pages()) {
  const file = path.join(ROOT, rel);
  let html = fs.readFileSync(file, 'utf8');
  const kit = KITS.find((item) => html.includes('id="' + item.data + '"'));
  if (!kit) continue;

  const island = html.match(new RegExp('<script type="application/json" id="' + kit.data + '">([\\s\\S]*?)</script>'));
  const cfg = JSON.parse(island[1]);

  /* Старый статический блок снимаем перед вставкой нового: сборка идемпотентна. */
  html = html.replace(new RegExp('[ \\t]*' + START + '[\\s\\S]*?' + END + '\\n?', 'g'), '');
  const block = articleRoot(cfg, kit.engine);
  const marker = '<div id="' + kit.root + '"></div>';
  if (!html.includes(marker)) {
    console.error('build-lab-static: нет контейнера #' + kit.root + ' в ' + rel);
    process.exitCode = 1;
    continue;
  }
  /* Порядок на странице фиксирован: «Теория по теме» (мост) → статический
     текст работы → интерактивный `#lab-root`. Статика всегда встаёт вплотную
     к контейнеру, а мост — перед ней (`scripts/lib/related.js` знает про
     LAB:STATIC:START). Любая другая комбинация давала «прыгающие» блоки:
     разметка не менялась, а `--check` обоих шагов расходился при пересборке.
     Отступ берём у самого контейнера — иначе блок, вставленный генератором
     стенда с отступом, после пересборки «съезжал» влево. */
  const at = html.indexOf(marker);
  const lineStart = html.lastIndexOf('\n', at) + 1;
  const indent = /^[ \t]*/.exec(html.slice(lineStart))[0];
  html = html.slice(0, at) + START + block + '\n' + indent + END + '\n' + indent + html.slice(at);
  pending.push([rel, html]);
  touched += 1;
  const visible = block.replace(/<[^>]+>/g, ' ');
  words += (visible.match(/[А-Яа-яЁёA-Za-z]{2,}/g) || []).length;
}

if (CHECK) {
  const stale = pending.filter(([rel, body]) => fs.readFileSync(path.join(ROOT, rel), 'utf8') !== body)
    .map(([rel]) => rel);
  if (stale.length) {
    console.error('build-lab-static --check: статика отстала от JSON (' + stale.length + '): ' +
      stale.slice(0, 8).join(', '));
    console.error('Запустите: node scripts/build-lab-static.js');
    process.exit(1);
  }
  console.log('lab-static --check: ' + touched + ' работ совпадают с JSON');
} else {
  for (const [rel, body] of pending) fs.writeFileSync(path.join(ROOT, rel), body);
  console.log('lab-static: ' + touched + ' работ, ~' + Math.round(words / Math.max(touched, 1)) +
    ' слов статического текста в среднем');
}
