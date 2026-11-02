'use strict';
// Guard the v13 canvas: text and semantic colours must stay readable on canvas, cards and washes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('assets/tokens.css', 'utf8');
const light = source.split(':root[data-theme="dark"]')[0];
const values = Object.fromEntries([...light.matchAll(/--u-([\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map(m => [m[1], m[2]]));
const darkSource = source.split(':root[data-theme="dark"]')[1].split('}')[0];
const dark = Object.fromEntries([...darkSource.matchAll(/--u-([\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map(m => [m[1], m[2]]));
function luminance(hex) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => p - q);
  return (y + .05) / (x + .05);
}
assert.equal(values.paper.toLowerCase(), '#efeee9', 'canvas должен оставаться тёплым светлым #efeee9');
assert.equal(values.surface.toLowerCase(), '#ffffff', 'карточки должны быть белыми');
assert.equal(values.accent.toLowerCase(), '#a8391d', 'акцент — глиняный, не фиолетовый');
for (const name of ['accent', 'ok', 'info', 'warn', 'danger', 'net', 'office', 'ops']) {
  const solid = values[name];
  const wash = values[name + '-soft'];
  assert(solid && wash, `нет пары ${name}/${name}-soft`);
  assert(ratio(solid, wash) >= 4.5, `${name} на ${name}-soft: ${ratio(solid, wash).toFixed(2)} < 4.5`);
  assert(ratio(solid, values.paper) >= 4.5, `${name} на paper: ${ratio(solid, values.paper).toFixed(2)} < 4.5`);
  assert(ratio(solid, values.surface) >= 4.5, `${name} на surface: ${ratio(solid, values.surface).toFixed(2)} < 4.5`);
}
for (const [theme, palette] of [['light', values], ['dark', dark]]) {
  for (const name of ['ink', 'ink-2', 'muted', 'accent']) {
    assert(palette[name] && palette.paper, `${theme}: нет ${name} или paper`);
    assert(ratio(palette[name], palette.paper) >= 4.5, `${theme}: ${name} на paper ниже 4.5:1`);
    assert(ratio(palette[name], palette.surface) >= 4.5, `${theme}: ${name} на surface ниже 4.5:1`);
  }
}
const rgb = values['net'].match(/\w{2}/g).map(h => parseInt(h, 16));
assert(!(rgb[2] > rgb[1] + 24 && rgb[0] > 40), 'сетевой акцент не должен уходить в фиолетово-синий');
console.log('Palette: paper, clay accent and semantic washes meet 4.5:1 in both themes');
