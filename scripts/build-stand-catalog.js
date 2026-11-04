#!/usr/bin/env node
/* ==========================================================================
   Статический список работ в каталогах вселенных: node scripts/build-stand-catalog.js

   Зачем. Списки работ жили только в JS (`QUESTS` в движках), поэтому из
   кабинета нельзя было перейти на работу без JavaScript, а робот видел
   страницы-сироты: у 17 работ не было ни одной входящей ссылки. Здесь тот же
   список (scripts/lib/stand-catalog.js читает движки, второй копии нет)
   вписывается между маркерами STAND:CATALOG:START / END как обычный <ul>
   по спринтам. Интерактивные карточки остаются на месте — это дополнение,
   а не замена: студент видит привычный роадмап.

   --check (CI) падает, если список отстал от движка.

   Запуск: node scripts/build-stand-catalog.js [--check]
   ========================================================================== */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, catalog } = require('./lib/stand-catalog');

const CHECK = process.argv.includes('--check');
const START = '<!-- STAND:CATALOG:START -->';
const END = '<!-- STAND:CATALOG:END -->';

const esc = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function render(universe) {
  const groups = new Map();
  for (const quest of universe.quests) {
    if (!groups.has(quest.sprint)) groups.set(quest.sprint, []);
    groups.get(quest.sprint).push(quest);
  }
  const sections = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([sprint, quests]) => {
    const name = universe.sprints[sprint] || ('спринт ' + sprint);
    return '<section class="stand-catalog-group">' +
      '<h3><span class="stand-catalog-num">' + String(sprint).padStart(2, '0') + '</span> ' +
      esc(name) + ' <span class="stand-catalog-count">' + quests.length + '</span></h3>' +
      '<ul class="stand-catalog-list">' +
      quests.map((quest) => '<li><a href="' + esc(quest.href) + '">' + esc(quest.title) + '</a></li>').join('') +
      '</ul></section>';
  }).join('');

  return '<nav class="stand-catalog" id="' + universe.rootId + '" aria-labelledby="' + universe.rootId + '-title">' +
    '<div class="stand-catalog-head"><h2 id="' + universe.rootId + '-title">' + esc(universe.title) + '</h2>' +
    '<span class="stand-catalog-meta">' + universe.quests.length + ' работ · по спринтам</span></div>' +
    sections +
    '<p class="stand-catalog-note">Список открывается без JavaScript и ведёт на страницу каждой работы: ' +
    'теория, задачи и контрольный тест читаются сразу, а прогресс и сдача включаются после входа в кабинет.</p>' +
    '</nav>';
}

const pending = [];
for (const universe of catalog()) {
  const file = path.join(ROOT, universe.catalog);
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(new RegExp('[ \\t]*' + START + '[\\s\\S]*?' + END + '\\n?', 'g'), '');

  /* Список ставим в конец <main>: он дополняет интерактив, а не спорит с ним
     за первый экран. Если якоря нет — сборка падает, а не молчит. */
  const anchor = '</main>';
  const at = html.lastIndexOf(anchor);
  if (at === -1) throw new Error(universe.catalog + ': нет </main>');
  html = html.slice(0, at) + START + render(universe) + '\n' + END + '\n  ' + html.slice(at);
  pending.push([universe.catalog, html]);
  if (!CHECK) fs.writeFileSync(file, html);
}

if (CHECK) {
  const stale = pending.filter(([rel, body]) => fs.readFileSync(path.join(ROOT, rel), 'utf8') !== body)
    .map(([rel]) => rel);
  if (stale.length) {
    console.error('build-stand-catalog --check: список отстал от движка: ' + stale.join(', '));
    console.error('Запустите: node scripts/build-stand-catalog.js');
    process.exit(1);
  }
  console.log('stand-catalog --check: ' + pending.length + ' каталога совпадают с движками');
} else {
  console.log('stand-catalog: ' + pending.length + ' каталога, ' +
    catalog().reduce((sum, u) => sum + u.quests.length, 0) + ' работ в статических списках');
}
