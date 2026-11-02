'use strict';
// Guard the light background and text-on-wash combinations used by badges.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('assets/workspace-tokens.css', 'utf8').split(':root[data-theme="dark"]')[0];
const values = Object.fromEntries([...source.matchAll(/--ws-([\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map(m => [m[1], m[2]]));
function luminance(hex) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
assert.equal(values.canvas.toLowerCase(), '#f8f9fa');
for (const name of ['accent', 'green', 'blue', 'orange', 'red', 'brown', 'terracotta', 'mustard', 'violet', 'slate']) {
  const [a, b] = [luminance(values[name]), luminance(values[name + '-wash'])].sort((x, y) => x - y);
  const ratio = (b + .05) / (a + .05);
  assert(ratio >= 4.5, `${name} text on wash: ${ratio.toFixed(2)} < 4.5`);
}
// Check both gradient endpoints for the accent colors used in the new surfaces.
const darkSource = fs.readFileSync('assets/workspace-tokens.css', 'utf8').split(':root[data-theme="dark"] {')[1].split('}')[0];
const dark = Object.fromEntries([...darkSource.matchAll(/--ws-([\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map(m => [m[1], m[2]]));
for (const [theme, palette] of [['light', values], ['dark', dark]]) {
  for (const name of ['accent', 'violet', 'green', 'terracotta', 'blue', 'mustard', 'brown']) {
    for (const background of ['surface', name + '-wash']) {
      const [a, b] = [luminance(palette[name]), luminance(palette[background])].sort((x, y) => x - y);
      assert((b + .05) / (a + .05) >= 4.5, `${theme} ${name} on ${background} fails contrast`);
    }
  }
}
// Feature panels intentionally keep the same charcoal/peach treatment in both themes.
for (const [foreground, background] of [['feature-ink', 'feature-bg'], ['feature-muted', 'feature-bg'], ['feature-accent', 'feature-bg'], ['feature-button-ink', 'feature-button'], ['feature-button-ink', 'feature-button-hover']]) {
  const [a, b] = [luminance(values[foreground]), luminance(values[background])].sort ( (x, y) => x - y);
  assert((b + .05) / (a + .05) >= 4.5, `${foreground} on ${background} fails contrast`);
}
console.log('Palette: light canvas unchanged; accent and feature text meet 4.5:1');
