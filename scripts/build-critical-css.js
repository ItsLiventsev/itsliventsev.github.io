'use strict';
/* Главная: синхронный каркас из действующих CSS, без ручной второй копии.
   node scripts/build-critical-css.js [--check] */
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('./lib/css-split');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const start = '<!-- CRITICAL:START -->';
const end = '<!-- CRITICAL:END -->';

function heroRules(file) {
  const units = parse(read(file)).units;
  const selected = units.filter(({ selector }) => /\.home-(?:hero|lede|actions|stats)(?:\b|-)/.test(selector));
  if (!selected.length) throw new Error(file + ': не найдены правила героя');
  return selected.map(({ selector, body, wrappers }) =>
    wrappers.map((wrapper) => wrapper + ' {\n').join('') + selector + ' {' + body + '}\n' + ' }\n'.repeat(wrappers.length)
  ).join('\n');
}
const css = read('assets/tokens.css') + '\n' + heroRules('assets/pages.css') + '\n' + heroRules('assets/home.css');
if (/<\/style/i.test(css)) throw new Error('небезопасный текст внутри критического CSS');
const block = start + '\n<style id="critical-home">\n' + css.trimEnd() + '\n</style>\n' + end;
const file = path.join(root, 'index.html');
const html = fs.readFileSync(file, 'utf8');
const from = html.indexOf(start), to = html.indexOf(end);
if ((from < 0) !== (to < 0) || (from >= 0 && (to < from || html.indexOf(start, from + 1) !== -1 || html.indexOf(end, to + 1) !== -1))) throw new Error('повреждены маркеры критического CSS');
let next;
if (from < 0) {
  const anchor = '<link rel="stylesheet" href="/assets/tokens.css';
  const pos = html.indexOf(anchor);
  if (pos < 0) throw new Error('нет ссылки на токены');
  next = html.slice(0, pos) + block + '\n' + html.slice(pos);
} else next = html.slice(0, from) + block + html.slice(to + end.length);
// Фоновая загрузка не должна лишать страницу оформления без JavaScript.
for (const name of ['tokens', 'pages', 'home']) {
  const escaped = name + '\\.css';
  const asyncLink = new RegExp('<link rel="stylesheet" href="/assets/' + escaped + '\\?v=[^" ]+" media="print" onload="this\\.media=\'all\'">');
  const fallback = new RegExp('<noscript><link rel="stylesheet" href="/assets/' + escaped + '\\?v=[^" ]+"></noscript>');
  if (!asyncLink.test(next) || !fallback.test(next)) throw new Error(name + ': нужны отложенная загрузка и noscript-фолбэк');
}
if (html !== next) {
  if (process.argv.includes('--check')) { console.error('Критический CSS устарел: node scripts/build-critical-css.js'); process.exitCode = 1; }
  else { fs.writeFileSync(file, next); console.log('Критический CSS главной обновлён'); }
} else console.log('Критический CSS главной совпадает с исходниками');
