'use strict';
// Контракт 43 заметок: содержимое инлайна и обе ветки загрузки не отстают от источников.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { criticalBlock, stylesheet } = require('./lib/critical-knowledge');
const { stamp } = require('./lib/asset-version');
const root = path.resolve(__dirname, '..');
const notes = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/knowledge/notes.json'), 'utf8')).notes;
assert(notes.length > 0);
for (const { id } of notes) {
  const html = fs.readFileSync(path.join(root, 'blog', id + '.html'), 'utf8');
  assert(html.includes(criticalBlock()), id + ': критический CSS не совпадает с исходниками');
  assert.equal((html.match(/<!-- CRITICAL:START -->/g) || []).length, 1, id + ': критический блок должен быть один');
  for (const sheet of ['tokens', 'pages', 'knowledge']) {
    assert(html.includes(stamp(stylesheet(sheet, true))), id + ': нужен отложенный ' + sheet + ' и noscript');
  }
  assert(html.includes(stamp(stylesheet('base', false))), id + ': нужен синхронный base.css');
}
console.log('Critical knowledge: ' + notes.length + ' страниц, источники и fallback совпадают');
