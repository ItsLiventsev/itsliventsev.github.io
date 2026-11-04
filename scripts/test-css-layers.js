'use strict';
// Слои CSS не спорят за одно свойство: node scripts/test-css-layers.js
//
// Каскад держится порядком tokens → base → pages → course. Если базовый слой
// и поздний задают одно и то же свойство простого селектора, правка в базовом
// слое молча не работает: именно так .ui-section-head потерял свои отступы и
// кегль, а .ui-callout получил гибридный вид из двух определений.
//
// Проверяем только простые селекторы (`.class`) верхнего уровня: вложенные
// правила и медиазапросы — законная адаптация, а не конфликт владельцев.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { LAYERS } = require('./lib/css-layers');

function parse(file) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const rules = new Map();
  for (const match of source.matchAll(/^([^@{}\s][^{}\n]*)\{([^{}]*)\}/gm)) {
    const selector = match[1].split(',').map(part => part.trim()).filter(Boolean).join(', ');
    const props = rules.get(selector) || {};
    for (const decl of match[2].split(';')) {
      if (!decl.includes(':')) continue;
      const [key, ...rest] = decl.split(':');
      props[key.trim()] = rest.join(':').trim();
    }
    rules.set(selector, props);
  }
  return rules;
}

const layers = new Map(LAYERS.map(file => [file, parse(file)]));

/* 1. Простые селекторы, которые базовый слой отдаёт поздним слоям насовсем:
   свойство объявлено и там, и там, значения разные — базовый ничего не решает. */
const conflicts = [];
for (const [selector, baseProps] of layers.get('assets/base.css')) {
  if (!/^\.[a-zA-Z][\w-]*$/.test(selector)) continue;
  for (const file of LAYERS.slice(1)) {
    const later = layers.get(file).get(selector);
    if (!later) continue;
    for (const [prop, value] of Object.entries(baseProps)) {
      if (!(prop in later) || later[prop] === value) continue;
      conflicts.push(selector + ' · ' + prop + ': base "' + value + '" → ' + path.basename(file) + ' "' + later[prop] + '"');
    }
  }
}
assert.deepEqual(conflicts, [], 'слои спорят за одно свойство:\n  ' + conflicts.join('\n  '));

/* 2. Дубль полного правила: один и тот же селектор с теми же свойствами в двух слоях —
   одно из определений просто не нужно. */
const clones = [];
const seen = new Map();
for (const file of LAYERS) {
  for (const [selector, props] of layers.get(file)) {
    const signature = selector + '|' + JSON.stringify(Object.entries(props).sort());
    // Мост имеет один исходник и генерируется в два не совмещаемых на его страницах слоя.
    if (seen.has(signature) && !(selector.includes('.rel-') && seen.get(signature) === 'assets/knowledge.css' && file === 'assets/course.css')) clones.push(selector + ' (' + path.basename(seen.get(signature)) + ' и ' + path.basename(file) + ')');
    else seen.set(signature, file);
  }
}
assert.deepEqual(clones, [], 'правило объявлено дважды без изменений: ' + clones.join(', '));

const shared = [...layers.get('assets/base.css').keys()]
  .filter(selector => LAYERS.slice(1).some(file => layers.get(file).has(selector))).length;
console.log('CSS layers: базовый слой не перекрывается (' + shared + ' селекторов делят слои, конфликтов 0)');
