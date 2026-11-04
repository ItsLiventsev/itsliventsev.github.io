'use strict';
// Честные числа главной: node scripts/test-stats.js
// Каждое число на главной — не «написано руками», а посчитано scripts/lib/site-stats.js
// и сверено здесь с разметкой, каталогом проектов и справкой по оформлению.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stats } = require('./lib/site-stats');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const numbers = stats();

/* 1. Плитки героя: четыре числа и их подписи */
const index = read('index.html');
const tilesBlock = index.slice(index.indexOf('<ul class="home-stats">'), index.indexOf('</ul>', index.indexOf('<ul class="home-stats">')));
const tiles = [...tilesBlock.matchAll(/<li><b>(\d+)<\/b><span>([^<]+)<\/span><\/li>/g)]
  .map(match => ({ value: Number(match[1]), label: match[2].trim() }));
assert.equal(tiles.length, 4, 'в герое должно остаться четыре плитки, получено ' + tiles.length);

const tile = keyword => {
  const found = tiles.filter(item => item.label.startsWith(keyword));
  assert.equal(found.length, 1, 'в герое ровно одна плитка «' + keyword + '…»');
  return found[0];
};
assert.equal(tile('пространств').value, numbers.universes, 'плитка «пространства» должна совпадать с числом вселенных');
assert.equal(tile('работ').value, numbers.works, 'плитка «работы» должна совпадать со страницами-заданиями');
assert.equal(tile('маршрут').value, numbers.routes, 'плитка «маршруты» должна совпадать со страницами стендов');
assert.equal(tile('термин').value, numbers.terms, 'плитка «термины» должна совпадать со словарём');

/* 2. Те же числа в текстах рядом: лид практики и ссылка на все маршруты */
const lede = index.match(/(\d+) работ[аы] в трёх направлениях/);
assert(lede, 'в лиде практики должно быть число работ');
assert.equal(Number(lede[1]), numbers.works, 'лид практики расходится со счётом работ');
const routesLink = index.match(/Все маршруты · (\d+)/);
assert(routesLink, 'ссылка «Все маршруты» должна показывать число');
assert.equal(Number(routesLink[1]), numbers.routes, 'ссылка «Все маршруты» расходится со счётом страниц стендов');

/* 3. Каталог проектов: та же пара чисел */
const projects = read('projects.html');
const catalog = projects.match(/(\d+) пространства<\/span>[\s\S]{0,120}?(\d+) работы?<\/span>/);
assert(catalog, 'в каталоге проектов должна быть пара «пространства · работы»');
assert.equal(Number(catalog[1]), numbers.universes, 'каталог проектов расходится с числом вселенных');
assert.equal(Number(catalog[2]), numbers.works, 'каталог проектов расходится с числом работ');

/* 4. Справка по оформлению описывает ровно эти числа */
const references = read('REFERENCES.md');
const flatReferences = references.replace(/\s+/g, ' ');
const doc = flatReferences.match(/(\d+) пространства, (\d+) работы, (\d+) маршрута, (\d+) термина/);
assert(doc, 'в REFERENCES.md должны быть перечислены все четыре числа');
assert.deepEqual(doc.slice(1).map(Number), [numbers.universes, numbers.works, numbers.routes, numbers.terms],
  'REFERENCES.md разошёлся с реальным счётом');
assert(references.includes('scripts/lib/site-stats.js'), 'REFERENCES.md должен называть модуль, который считает числа');

/* 5. Следов старых чисел не осталось ни на сайте, ни в справке */
const stale = [];
for (const file of ['index.html', 'projects.html', 'REFERENCES.md']) {
  if (/41 работ/.test(read(file))) stale.push(file);
}
assert.deepEqual(stale, [], 'остались старые числа: ' + stale.join(', '));

console.log('Stats: ' + numbers.universes + ' пространства, ' + numbers.works + ' работы, '
  + numbers.routes + ' маршрута, ' + numbers.terms + ' термина — разметка совпадает со скриптом');
console.log('Stats (notes): ' + numbers.notes + ' заметки в базе знаний не заявлены на главной — кандидат на пятую плитку');
