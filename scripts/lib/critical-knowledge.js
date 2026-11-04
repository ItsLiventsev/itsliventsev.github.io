'use strict';
/* Критические стили шаблона заметки берём из актуальных слоёв, не из копии.
   Базовый слой остаётся синхронным для оболочки. */
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('./css-split');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function criticalCss() {
  const units = parse(read('assets/knowledge.css')).units;
  const pattern = /\.kn-(?:note|def|ai|rail|mini|ref|facts|tagcloud)(?:\b|-)|\.kn-minitoc\b/;
  const selected = units.filter(unit => pattern.test(unit.selector));
  if (!selected.some(unit => unit.selector === '.kn-note-head h1')) throw new Error('не найдены стили заголовка заметки');
  const css = read('assets/tokens.css') + '\n' + selected.map(({ selector, body, wrappers }) =>
    wrappers.map(wrapper => wrapper + ' {\n').join('') + selector + ' {' + body + '}\n' + '}\n'.repeat(wrappers.length)
  ).join('\n');
  if (/<\/style/i.test(css)) throw new Error('небезопасный текст критического CSS');
  return css.trimEnd();
}
function criticalBlock() {
  return '<!-- CRITICAL:START -->\n<style id="critical-knowledge">\n' + criticalCss() + '\n</style>\n<!-- CRITICAL:END -->';
}
function stylesheet(name, deferred) {
  const href = '/assets/' + name + '.css';
  if (!deferred) return '<link rel="stylesheet" href="' + href + '">';
  return '<link rel="stylesheet" href="' + href + '" media="print" onload="this.media=\'all\'">\n'
    + '<noscript><link rel="stylesheet" href="' + href + '"></noscript>';
}
module.exports = { criticalCss, criticalBlock, stylesheet };
