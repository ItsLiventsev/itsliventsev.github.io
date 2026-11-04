'use strict';
// Опциональные слои подключаются только там, где нужны: node scripts/test-css-split.js
//
// pages.css — общий слой для всех 140 маршрутов, но слой базы знаний (kn-*)
// нужен лишь ленте и заметкам. Если такой файл подключён на странице без его
// классов, страница платит за чужой CSS; если классы есть, а файла нет —
// страница выглядит сломанной. Проверка держит обе стороны.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

/* sheet → префиксы классов, которые он обслуживает */
const OPTIONAL = {
  'assets/knowledge.css': ['kn-']
};

/* Слои, которые обязаны остаться в общем файле: мост нужен и заметкам, и стендам. */
const SHARED = {
  'assets/pages.css': ['rel-']
};

const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.arena']);

function pages(dir = '.', acc = []) {
  for (const item of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (dir === '.' && SKIP_DIRS.has(item.name)) continue;
    const relative = dir === '.' ? item.name : dir + '/' + item.name;
    if (item.isDirectory()) pages(relative, acc);
    else if (item.name.endsWith('.html')) acc.push(relative);
  }
  return acc;
}

const problems = [];
let linked = 0;
let skipped = 0;

for (const [sheet, prefixes] of Object.entries(OPTIONAL)) {
  const base = path.basename(sheet);
  const css = read(sheet);
  /* 1. Слой не должен тянуть чужие классы: иначе общий файл его не отпустит. */
  for (const [sharedSheet, sharedPrefixes] of Object.entries(SHARED)) {
    for (const prefix of sharedPrefixes) {
      if (new RegExp('\\.' + prefix).test(css)) problems.push(base + ' содержит классы .' + prefix + '* из ' + path.basename(sharedSheet));
    }
  }
  if (!prefixes.some((prefix) => css.includes('.' + prefix))) problems.push(base + ' не содержит ни одного класса ' + prefixes.join('/'));

  /* 2. Подключение совпадает с использованием. */
  for (const file of pages()) {
    const source = read(file);
    const uses = prefixes.some((prefix) => new RegExp('class="[^"]*\\b' + prefix).test(source));
    const isLinked = source.includes('/' + sheet);
    if (uses && !isLinked) problems.push(file + ': использует .' + prefixes.join('/') + '* без ' + base);
    if (isLinked && !uses) problems.push(file + ': подключает ' + base + ' без единого класса этого файла');
    if (isLinked) linked += 1;
    if (!uses && !isLinked) skipped += 1;
  }
}

/* 3. Общий слой не должен содержать классы опционального: иначе смысла в разделении нет. */
for (const [sheet, prefixes] of Object.entries(OPTIONAL)) {
  const shared = read('assets/pages.css');
  for (const prefix of prefixes) {
    if (new RegExp('^\\s*\\.' + prefix, 'm').test(shared)) problems.push('pages.css всё ещё содержит .' + prefix + '* — слой ' + path.basename(sheet) + ' не разделён');
  }
}

assert.deepEqual(problems, [], 'разделение слоёв требует правки:\n  ' + problems.join('\n  '));
console.log('CSS split: ' + linked + ' страниц подключают опциональные слои, ' + skipped + ' обходятся общим pages.css');
