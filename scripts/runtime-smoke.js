'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const store = {};
global.window = global;
global.self = global;
global.matchMedia = () => ({ matches: false });
global.document = {
  readyState: 'loading',
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
  documentElement: { setAttribute: () => {}, getAttribute: () => 'dark', animate: () => {} },
  body: { insertBefore: () => {}, firstChild: null },
};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
global.startViewTransition = undefined;

global.DOMKIT = require(path.join(ROOT, 'assets/dom-kit.js'));
if (!global.DOMKIT || typeof global.DOMKIT.esc !== 'function') throw new Error('DOMKIT не поднялся');
const esc = global.DOMKIT.esc;
console.log('esc check:', esc('<a href="x">&\'"') === '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&quot;');

for (const f of ['mascots.js','league.js','fgos-skills.js','stands.js','ops-engine.js','ops-kit.js','ops-hub.js','lab-kit.js','league-page.js','submissions.js']) {
  delete require.cache[require.resolve(path.join(ROOT, 'assets', f))];
  require(path.join(ROOT, 'assets', f));
  console.log('load OK:', f);
}
console.log('RUNTIME SMOKE OK');
