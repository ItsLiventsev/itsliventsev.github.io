'use strict';
// Один исходник моста используется без лишних CSS-запросов на двух семействах страниц.
// node scripts/build-related-css.js [--check]
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/related.css'), 'utf8').trim();
const START = '/* RELATED CSS:START — generated from assets/related.css */';
const END = '/* RELATED CSS:END */';
const check = process.argv.includes('--check');
let changed = 0;
for (const file of ['assets/knowledge.css', 'assets/course.css']) {
  const full = path.join(root, file);
  const text = fs.readFileSync(full, 'utf8');
  const start = text.indexOf(START), end = text.indexOf(END);
  if ((start < 0) !== (end < 0) || (start >= 0 && (end < start || text.indexOf(START, start + 1) >= 0 || text.indexOf(END, end + 1) >= 0))) {
    throw new Error(file + ': повреждены маркеры RELATED CSS');
  }
  const block = START + '\n' + source + '\n' + END;
  const next = start < 0 ? text.trimEnd() + '\n\n' + block + '\n'
    : text.slice(0, start) + block + text.slice(end + END.length);
  if (next !== text) {
    changed++;
    if (!check) fs.writeFileSync(full, next);
    else console.error(file + ': мост CSS не совпадает с исходником');
  }
}
if (check && changed) process.exitCode = 1;
else console.log('Related CSS: два слоя совпадают с исходником');
