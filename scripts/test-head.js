'use strict';
// <head> без дублей: node scripts/test-head.js
//
// На главной жили два набора служебных ссылок и два набора JSON-LD: руками
// написанный блок и сгенерированный SEO:AUTO. Браузер молча берёт первый,
// поисковик читает оба, а правка «одного из них» ничего не меняет. Проверка
// держит head в одном экземпляре каждой сущности.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.arena', 'assets']);

function pages(dir = '.', acc = []) {
  for (const item of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (dir === '.' && SKIP_DIRS.has(item.name)) continue;
    const relative = dir === '.' ? item.name : dir + '/' + item.name;
    if (item.isDirectory()) pages(relative, acc);
    else if (item.name.endsWith('.html')) acc.push(relative);
  }
  return acc;
}

function head(source) {
  const end = source.indexOf('</head>');
  return end === -1 ? '' : source.slice(0, end);
}

const problems = [];
let checked = 0;
for (const file of pages()) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (/http-equiv="refresh"/i.test(source)) continue; // редирект-заглушка
  const headHtml = head(source);
  checked += 1;

  const count = (pattern) => (headHtml.match(pattern) || []).length;
  if (count(/<title[ >]/g) !== 1) problems.push(file + ': <title> должен быть один, найдено ' + count(/<title[ >]/g));
  const description = count(/<meta name="description"/g);
  if (description > 1) problems.push(file + ': несколько meta description (' + description + ')');
  const canonical = count(/rel="canonical"/g);
  if (canonical > 1) problems.push(file + ': несколько canonical (' + canonical + ')');
  const viewport = count(/name="viewport"/g);
  if (viewport !== 1) problems.push(file + ': мета viewport должна быть ровно одна (' + viewport + ')');
  const charset = count(/<meta charset/gi);
  if (charset !== 1) problems.push(file + ': мета charset должна быть ровно одна (' + charset + ')');

  /* Одинаковые <link> в head — это всегда дубль: повторный preload или icon
     ничего не ускоряет, но маскирует второй, «ручной» набор ссылок. */
  const links = new Map();
  for (const tag of headHtml.match(/<link[^>]*>/g) || []) {
    const key = tag.replace(/\s+/g, ' ').trim();
    links.set(key, (links.get(key) || 0) + 1);
  }
  for (const [tag, times] of links) {
    if (times > 1) problems.push(file + ': дубль ссылки ' + tag.slice(0, 90));
  }

  /* Продублированный JSON-LD — двойная разметка для поисковика. */
  const blocks = [...headHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => match[1].replace(/\s+/g, ' ').trim());
  for (const block of new Set(blocks)) {
    if (blocks.filter(item => item === block).length > 1) problems.push(file + ': дубль JSON-LD ' + block.slice(0, 60) + '…');
  }

  /* Порядок: тема ставится инлайновым скриптом до таблиц стилей, иначе тёмная
     тема мигает светлой на первой отрисовке. */
  const themeScript = headHtml.indexOf('itsliventsev-theme');
  const firstStyle = headHtml.indexOf('rel="stylesheet"');
  if (themeScript !== -1 && firstStyle !== -1 && themeScript > firstStyle) {
    problems.push(file + ': скрипт темы должен идти до таблиц стилей');
  }
}

assert.deepEqual(problems, [], 'head требует правки:\n  ' + problems.join('\n  '));
console.log('Head: ' + checked + ' страниц без дублей title/description/canonical/viewport, ссылок и JSON-LD');
