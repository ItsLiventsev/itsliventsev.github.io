'use strict';
// Проверка единого списка, дерева, поиска и совместимости старых адресов.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { loadTree, wikiNav } = require('./build-materials');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const { tree, notes } = loadTree();
const blog = read('blog.html');
assert(blog.includes(wikiNav(tree, '')), 'дерево заметок отстало от источника');
assert(!blog.includes('href="/blog/materials.html"'), 'в ленте не должно быть отдельной вкладки материалов');
const dom = new JSDOM(blog, { runScripts: 'outside-only', url: 'https://example.test/blog.html' });
const { document, Event } = dom.window;
const lists = document.querySelectorAll('[data-catalog-list]');
assert.equal(lists.length, 1, 'все записи находятся в одном списке');
const cards = [...lists[0].querySelectorAll('[data-catalog-tags]')];
assert.equal(cards.length, notes.length + tree.order.length);
for (const note of notes) {
  assert.equal(lists[0].querySelectorAll('a[href="/blog/' + note.id + '.html"]').length, 1);
  assert(document.querySelector('.kn-wiki-tree a[href="/blog/' + note.id + '.html"]'), note.id + ': нет в дереве');
}
for (const id of tree.order) {
  assert.equal(lists[0].querySelectorAll('a[href="/blog/materials/' + id + '.html"]').length, 1);
  const html = read('blog/materials/' + id + '.html');
  assert(html.includes(wikiNav(tree, id)), id + ': дерево отстало от источника');
  assert.match(html, /<main id="main-content">\s*<div class="kn-wiki-layout">/, id + ': дерево должно быть внутри сетки');
  assert(html.includes('href="/blog.html#materials"'), id + ': нет возврата в общую базу');
}
for (const section of tree.sections) {
  assert(document.getElementById(section.id), 'старый якорь раздела ' + section.id);
  assert(document.getElementById('mat-' + section.id), 'старый якорь заголовка ' + section.id);
}
assert(document.getElementById('materials'));
assert(!document.querySelector('.kn-materials-index'), 'не должно быть отдельного списка материалов');
dom.window.eval(read('assets/catalog.js'));
const query = document.getElementById('note-query');
query.value = 'vlan'; query.dispatchEvent(new Event('input', { bubbles: true }));
let visible = cards.filter(card => !card.hidden);
assert(visible.some(card => card.getAttribute('href').startsWith('/blog/materials/')), 'поиск должен находить материал');
assert(visible.some(card => card.getAttribute('href').startsWith('/blog/kn-')), 'поиск должен находить заметку');
document.querySelector('[data-catalog-filter="network"]').click();
visible = cards.filter(card => !card.hidden);
assert(visible.some(card => card.getAttribute('href').startsWith('/blog/materials/')), 'фильтр работает по материалам');
assert(visible.some(card => card.getAttribute('href').startsWith('/blog/kn-')), 'фильтр работает по заметкам');
document.querySelector('[data-catalog-filter="all"]').click();
document.querySelector('[data-catalog-clear]').click();
assert.equal(cards.filter(card => !card.hidden).length, cards.length, 'сброс возвращает все записи');
dom.window.close();
const legacy = read('blog/materials.html');
assert(legacy.includes('http-equiv="refresh"') && legacy.includes('url=/blog.html#materials'));
assert(legacy.includes('location.hash') && legacy.includes('noindex, follow'));
console.log('Unified materials: ' + notes.length + ' заметок и ' + tree.order.length + ' тем в одной ленте, фильтры и старые адреса работают');
