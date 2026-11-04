'use strict';
// Генераторы и итоговая разметка должны оставаться одной базой знаний.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTree, wikiNav, materialSections } = require('./build-materials');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const { tree } = loadTree();
const blog = read('blog.html');
assert(blog.includes(wikiNav(tree, '')), 'дерево заметок отстало от источника');
assert(blog.includes(materialSections(tree)), 'список материалов отстал от источника');
assert(blog.includes('id="materials"') && blog.includes('Учебные материалы теперь здесь'));
assert(!blog.includes('href="/blog/materials.html"'), 'в ленте не должно быть отдельной вкладки материалов');
for (const id of tree.order) {
  const html = read('blog/materials/' + id + '.html');
  assert(html.includes(wikiNav(tree, id)), id + ': дерево отстало от источника');
  assert.match(html, /<main id="main-content">\s*<div class="kn-wiki-layout">/, id + ': дерево должно быть внутри сетки, а не на flex-main');
  assert(html.includes('href="/blog.html#materials"'), id + ': нет возврата в общую базу');
}
const legacy = read('blog/materials.html');
assert(legacy.includes('http-equiv="refresh"') && legacy.includes('url=/blog.html#materials'));
assert(legacy.includes('location.hash') && legacy.includes('noindex, follow'));
console.log('Unified materials: лента и ' + tree.order.length + ' тем совпадают с источником; старый адрес сохранён');
