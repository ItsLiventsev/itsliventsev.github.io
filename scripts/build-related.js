/* Мост «теория ↔ практика» — обход страниц.
 *
 * Рендер блока живёт в scripts/lib/related.js: его же использует
 * scripts/build-knowledge.js, который генерирует заметки. Этот скрипт:
 *   1) проверяет таблицу связей assets/data/topics.json (файлы на месте, нет пар-дублей);
 *   2) расставляет блоки на стендах («Теория по теме»);
 *   3) чинит заметки, если их правили руками или связь поменялась;
 *   4) снимает блоки со страниц, которых больше нет в конфиге.
 *
 * `--check` (CI) ничего не пишет и падает, если страница разошлась с конфигом.
 *
 * Запуск: node scripts/build-related.js [--check]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const related = require('./lib/related');

const ROOT = related.ROOT;
const CHECK = process.argv.includes('--check');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = file => fs.existsSync(path.join(ROOT, file));
const noteFile = slug => 'blog/' + slug + '.html';

function fail(message) {
  console.error('build-related: ' + message);
  process.exit(1);
}

/* ——— 1. конфиг ——— */
const data = related.load();
if (!data.pairs) fail(related.CONFIG + ': пустой список пар');
const seen = new Set();
for (const [slug, practices] of data.byNote) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail(related.CONFIG + ': странный слаг заметки «' + slug + '»');
  if (!exists(noteFile(slug))) fail(related.CONFIG + ': нет страницы заметки ' + noteFile(slug));
  for (const practice of practices) {
    if (!/^stands\/[a-z0-9/-]+\.html$/.test(practice)) fail(related.CONFIG + ': практика вне stands/ — «' + practice + '»');
    if (!exists(practice)) fail(related.CONFIG + ': нет страницы стенда ' + practice);
    const key = slug + ' → ' + practice;
    if (seen.has(key)) fail(related.CONFIG + ': повтор пары ' + key);
    seen.add(key);
  }
}
for (const [practice, notes] of data.byPractice) {
  for (const slug of notes) {
    if (!related.h1Of(noteFile(slug))) fail(noteFile(slug) + ': нет h1 — нечего показать в ссылке');
  }
  if (!related.h1Of(practice)) fail(practice + ': нет h1 — нечего показать в ссылке');
}

/* ——— 2. план ——— */
const plan = [];
for (const [slug, practices] of data.byNote) {
  const file = noteFile(slug);
  plan.push({ file, key: slug, apply: source => related.withNoteBlock(source, slug) });
}
for (const [file, notes] of data.byPractice) {
  plan.push({ file, key: file, apply: source => related.withPracticeBlock(source, file) });
}

/* ——— 3. страницы вне плана, но с блоком: связь убрали — блок снимаем ——— */
const planned = new Set(plan.map(entry => entry.file));
const orphans = [];
(function walk(dir) {
  for (const item of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (['.git', 'node_modules', '__pycache__', '.arena'].includes(item.name)) return;
    const relative = dir === '.' ? item.name : dir + '/' + item.name;
    if (item.isDirectory()) walk(relative);
    else if (/\.html$/.test(item.name) && !planned.has(relative) && read(relative).includes(related.START)) orphans.push(relative);
  }
})('.');

/* ——— 4. сборка ——— */
const drifted = [];
for (const { file, apply } of plan) {
  const source = read(file);
  const next = apply(source);
  if (next === source) continue;
  drifted.push(file);
  if (!CHECK) fs.writeFileSync(path.join(ROOT, file), next, 'utf8');
}
for (const file of orphans) {
  drifted.push(file);
  if (!CHECK) {
    fs.writeFileSync(path.join(ROOT, file), related.stripBlock(read(file)), 'utf8');
    console.log('убран лишний блок: ' + file);
  }
}

if (CHECK) {
  if (drifted.length) {
    for (const file of drifted) console.log('  ~ ' + file);
    fail('блоки разошлись с ' + related.CONFIG + ' (' + drifted.length + ' страниц). Пересоберите: node scripts/build-related.js');
  }
  console.log('build-related: ' + plan.length + ' страниц совпадают с ' + related.CONFIG
    + ' (' + data.byNote.size + ' заметок, ' + data.byPractice.size + ' стендов, ' + data.pairs + ' связей)');
} else {
  console.log('build-related: ' + drifted.length + ' страниц обновлено (' + data.pairs + ' связей: '
    + data.byNote.size + ' заметок ↔ ' + data.byPractice.size + ' стендов)');
}
