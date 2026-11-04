/* ==========================================================================
   Каталог работ — общий источник для разметки и для проверок.

   Списки работ жили только в JS (QUESTS в stands.js, ops-hub.js,
   office-hub.js), поэтому страницы работ не имели ни одной статической
   входящей ссылки: 17 работ были сиротами, а робот не мог пройти от кабинета
   к работе. Здесь те же списки читаются из самих движков (без второй копии),
   чтобы страницы каталогов можно было сверстать статически, а тест — сверить,
   что каждая работа достижима по ссылке.
   ========================================================================== */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

/* Вселенная → движок со списком QUESTS и каталог, куда вставляется список. */
const UNIVERSES = [
  {
    id: 'setpolis',
    engine: 'stands.js',
    hrefPrefix: '',
    catalog: 'stands/setpolis.html',
    rootId: 'stand-catalog',
    sprintSource: 'stands.js',
    sprintVar: 'SPRINT_STORY',
    title: 'Все работы СетьПолиса',
  },
  {
    id: 'ops',
    engine: 'ops-hub.js',
    hrefPrefix: '',
    catalog: 'stands/ops/index.html',
    rootId: 'stand-catalog',
    sprintSource: 'ops-hub.js',
    title: 'Все работы ДатаПолиса',
  },
  {
    id: 'office',
    engine: 'office-hub.js',
    hrefPrefix: '',
    catalog: 'stands/office/index.html',
    rootId: 'stand-catalog',
    sprintSource: 'office-hub.js',
    title: 'Все работы ОфисПолиса',
  },
];

/* QUESTS живёт внутри IIFE движка. Выполнять его целиком в Node нельзя,
   поэтому список достаётся разбором литерала: строки `{ id: '…', … }`
   до закрывающей `];`. Формат одинаковый во всех трёх файлах. */
function readQuests(engineFile) {
  const source = fs.readFileSync(path.join(ROOT, 'assets', engineFile), 'utf8');
  const start = source.indexOf('var QUESTS = [');
  if (start === -1) throw new Error(engineFile + ': не найден QUESTS');
  const end = source.indexOf('\n  ];', start);
  const block = source.slice(start, end === -1 ? source.length : end);
  const quests = [];
  /* Порядок полей в литералах разный: в stands.js title идёт до href, в
     ops-hub.js — после. Поэтому режем блок на объекты `{ … }` и берём поля
     по отдельности, а не одним регулярным выражением по порядку. */
  for (const chunk of block.split(/\{\s*id:/).slice(1)) {
    const id = (chunk.match(/^\s*'([^']+)'/) || [])[1];
    const sprint = Number((chunk.match(/sprint:\s*(\d+)/) || [])[1]);
    const title = (chunk.match(/title:\s*'([^']+)'/) || [])[1];
    const href = (chunk.match(/href:\s*'([^']+)'/) || [])[1];
    if (!id || !href) continue;
    quests.push({ id, sprint, title: title || id, href });
  }
  if (!quests.length) throw new Error(engineFile + ': QUESTS не разобран');
  return quests;
}

/* Названия спринтов: `var SPRINTS = { 1: { title: '…' }, … }`. Нужны, чтобы
   статический список группировался по смыслу, а не по номеру. */
function readSprints(engineFile, variable = 'SPRINTS') {
  const source = fs.readFileSync(path.join(ROOT, 'assets', engineFile), 'utf8');
  const start = source.indexOf('var ' + variable + ' = {');
  if (start === -1) return {};
  const block = source.slice(start, source.indexOf('\n  };', start));
  const sprints = {};
  for (const match of block.matchAll(/(\d+):\s*\{\s*title:\s*'([^']+)'/g)) {
    sprints[Number(match[1])] = match[2];
  }
  return sprints;
}

/* Плоский список работ по вселенной + спринты для подписей. */
function catalog() {
  return UNIVERSES.map((universe) => ({
    ...universe,
    quests: readQuests(universe.engine),
    sprints: readSprints(universe.sprintSource, universe.sprintVar || 'SPRINTS'),
  }));
}

module.exports = { ROOT, UNIVERSES, catalog, readQuests, readSprints };
