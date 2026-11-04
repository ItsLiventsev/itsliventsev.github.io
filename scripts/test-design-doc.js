'use strict';
// DESIGN_SYSTEM.md не должен описывать то, чего нет: node scripts/test-design-doc.js
// Справка по оформлению — контракт: если в ней назван класс, он обязан существовать
// в слоях CSS, а удалённые компоненты не имеют права там воскресать. Раньше справка
// описывала обложку `.kn-card-cover` и вариант `--lead`, которых в системе не было.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const LAYERS = ['assets/tokens.css', 'assets/base.css', 'assets/pages.css', 'assets/knowledge.css', 'assets/course.css'];
const css = LAYERS.map(read).join('\n');
const doc = read('DESIGN_SYSTEM.md');

/* 1. Каждый названный в справке класс существует в CSS.
   Записи с `*` — семейства с общей основой (`.catalog-*`, `.u-art-*`), их проверяет шаг 3. */
const known = new Set([...css.matchAll(/\.([a-zA-Z][\w-]+)/g)].map(match => match[1]));
const mentioned = [...doc.matchAll(/`\.([a-zA-Z][\w-]*)(\*)?`/g)]
  .map(match => ({ name: match[1], family: Boolean(match[2]) }));

const missing = [];
const seen = new Set();
for (const item of mentioned) {
  if (seen.has(item.name)) continue;
  seen.add(item.name);
  if (item.family) continue;
  if (!known.has(item.name)) missing.push(item.name);
}
assert.deepEqual(missing, [], 'справка называет классы, которых нет в CSS: ' + missing.join(', '));

/* 2. Удалённые компоненты не возвращаются в справку */
const removed = ['catalog-stat', 'ui-btn--ghost', 'ui-meta-row', 'ui-hairline', 'ui-grid-2', 'ui-grid-3',
  'ui-stack', 'ui-field', 'ui-label', 'ui-input', 'ui-select', 'ui-textarea', 'editorial-meta',
  'is-danger', 'fs-105', 'kn-graph-fallback', 'kn-card--lead', 'kn-card--tall', 'notice-rose'];
for (const dead of removed) {
  assert(!new RegExp('`\\.' + dead + '`').test(doc), 'справка описывает удалённый класс .' + dead);
}

/* 3. Семейства с `*` действительно существуют основой в CSS */
for (const item of mentioned.filter(entry => entry.family)) {
  const base = item.name.replace(/-$/, '');
  assert(known.has(base) || new RegExp('\\.' + base.replace(/[-]/g, '\\-')).test(css),
    'в справке семейство .' + item.name + '* без основы в CSS');
}

/* 4. Ключевые компоненты справка обязана называть: иначе её перестанут читать как контракт */
for (const core of ['ui-tabbar', 'ui-subbar', 'home-stats', 'ui-callout', 'catalog-row', 'kn-card',
  'kn-card--wide', 'kn-card--half', 'kn-card--flat']) {
  assert(doc.includes('`.' + core), 'в DESIGN_SYSTEM.md не описан компонент .' + core);
}

/* 5. Мобильный порог подбара в справке совпадает с CSS */
assert(doc.includes('до 820 px подбар скрыт'), 'в справке должен быть порог подбара 820 px');
assert(/max-width: 820px/.test(read('assets/course.css')), 'в course.css должен быть порог 820 px');

/* 6. Обложек нет — и справка этого не обещает */
assert(!doc.includes('960×540'), 'справка обещает обложки 960×540, которых в системе нет');
const noteFiles = fs.readdirSync(path.join(ROOT, 'blog')).filter(file => /^kn-.+\.html$/.test(file));
assert(noteFiles.length > 30, 'заметки не найдены: ' + noteFiles.length);
const withImages = noteFiles.filter(file => /<img/.test(read('blog/' + file)));
assert.deepEqual(withImages, [], 'в заметках появились обложки, хотя система их не описывает: ' + withImages.join(', '));

console.log('Design doc: ' + seen.size + ' классов в справке существуют в CSS, удалённые компоненты не вернулись');
