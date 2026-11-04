'use strict';
// Run with Node 18+: node scripts/test-service-worker.js
// Версия кэша и список старых кэшей берутся из sw.js, поэтому апдейт версии
// не требует правок в тесте; документы не должны фиксировать номер вовсе.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const listeners = {};
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const swSource = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
/* Номер кэша, старые версии и пары «-runtime» выводятся из самого sw.js:
   раньше здесь лежал список из сорока имён и три места с текущей версией,
   которые приходилось править при каждом апдейте. */
const current = Number((swSource.match(/CACHE = 'itsliventsev-v(\d+)'/) || [])[1]);
assert(Number.isFinite(current) && current > 0, 'sw.js должен объявлять CACHE = itsliventsev-vNN');
const CURRENT_CACHE = 'itsliventsev-v' + current;
const RUNTIME_CACHE = CURRENT_CACHE + '-runtime';
const stores = new Map([['unrelated-app', new Map()]]);
for (let version = 1; version < current; version += 1) {
  stores.set('itsliventsev-v' + version, new Map());
  stores.set('itsliventsev-v' + version + '-runtime', new Map());
}
stores.set(CURRENT_CACHE, new Map());
stores.set(RUNTIME_CACHE, new Map());
const normalize = request => new URL(typeof request === 'string' ? request : request.url, 'https://site.test').href;
const caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      async add(url) { if (url === '/faq.html') throw Error('unavailable'); store.set(normalize(url), new Response(url)); },
      async put(request, response) { store.set(normalize(request), response); },
      async match(request) { const value = store.get(normalize(request)); return value && value.clone(); },
      async keys() { return [...store.keys()].map(url => ({ url })); },
      async delete(request) { return store.delete(normalize(request)); }
    };
  },
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); }
};
let network = async () => { throw Error('offline'); };
let skipped = false, claimed = false;
const self = { addEventListener(type, fn) { listeners[type] = fn; }, skipWaiting() { skipped = true; }, clients: { claim() { claimed = true; } } };
vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), { self, caches, URL, Response, location: { origin: 'https://site.test' }, fetch: (...args) => network(...args), Promise });
async function lifecycle(type) { let wait; listeners[type]({ waitUntil(p) { wait = p; } }); await wait; }
async function message(type) {
  let wait, reply;
  listeners.message({ data: {type}, ports: [{postMessage(value) {reply = value;}}], waitUntil(p) {wait = p;} });
  await wait;
  return reply;
}
async function request(url, mode = 'cors') {
  let result;
  listeners.fetch({ request: { url, mode, method: 'GET' }, respondWith(p) { result = p; } });
  return result ? await result : null;
}
(async () => {
  await lifecycle('install'); assert(skipped);
  assert(stores.get(CURRENT_CACHE).has(normalize('/index.html'))); // one failed file does not discard the rest
  await lifecycle('activate'); assert(claimed);
  for (let version = 1; version < current; version += 1) {
    assert(!stores.has('itsliventsev-v' + version), 'старый кэш v' + version + ' должен быть удалён');
    assert(!stores.has('itsliventsev-v' + version + '-runtime'), 'старый рантайм-кэш v' + version + ' должен быть удалён');
  }
  assert(stores.has('unrelated-app'), 'чужие кэши не трогаем');
  let response = await request('https://site.test/missing.js');
  assert.equal(response.status, 503); assert.match(response.headers.get('content-type'), /text\/plain/);
  response = await request('https://site.test/assets/base.css?v=1'); assert.equal(await response.text(), '/assets/base.css');
  for (const sheet of ['home.css', 'cases.css']) {
    response = await request('https://site.test/assets/' + sheet + '?v=hash');
    assert.equal(await response.text(), '/assets/' + sheet, sheet + ': офлайн-слой должен быть в прекеше');
  }
  response = await request('https://site.test/assets/base.css?v=1&other=2'); assert.equal(response.status, 503);
  response = await request('https://site.test/unknown', 'navigate'); assert.equal(await response.text(), '/assets/offline.html');
  assert.equal(await request('https://api.github.com/repos/example'), null);
  network = async () => new Response('fresh');
  for (let i = 0; i < 130; i++) await request('https://site.test/test-' + i + '.js');
  assert.equal(stores.get(RUNTIME_CACHE).size, 120);
  assert(!stores.get(RUNTIME_CACHE).has(normalize('/test-0.js')));
  network = async () => { throw Error('offline'); };
  response = await request('https://site.test/test-129.js'); assert.equal(await response.text(), 'fresh');
  response = await request('https://site.test/blog/posts.json'); assert.equal(await response.text(), '/blog/posts.json');
  response = await request('https://site.test/assets/home-reading.js?v=20261102r2'); assert.equal(await response.text(), '/assets/home-reading.js');
  response = await request('https://site.test/assets/shell.js?v=new'); assert.equal(await response.text(), '/assets/shell.js');
  assert((await message('GET_CACHE_SIZE')).count > 120);
  assert((await message('CLEAR_CACHE')).cleared);
  response = await request('https://site.test/unknown', 'navigate'); assert.equal(await response.text(), '/assets/offline.html');
  response = await request('https://site.test/test-129.js'); assert.equal(response.status, 503);
  /* Номер кэша живёт в одном файле. Документация с «актуальной» версией
     устаревает молча: в QA_REPORT стоял v19 при действующем v42. */
  const docs = ['QA_REPORT.md', 'REFERENCES.md', 'DESIGN_SYSTEM.md', 'CONTENT_QA.md', 'AGENTS.md'];
  for (const file of docs) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const stale = fs.readFileSync(full, 'utf8').match(/itsliventsev-v\d+/g);
    assert(!stale, file + ' фиксирует номер кэша (' + (stale || []).join(', ') + '): номер живёт только в sw.js');
  }
  for (const file of fs.readdirSync(path.join(ROOT, 'docs'))) {
    if (!file.endsWith('.md')) continue;
    const stale = fs.readFileSync(path.join(ROOT, 'docs', file), 'utf8').match(/itsliventsev-v\d+/g);
    assert(!stale, 'docs/' + file + ' фиксирует номер кэша (' + (stale || []).join(', ') + ')');
  }
  console.log('Service worker: bounded runtime cache, isolation and offline shell OK (v' + current + ')');
})().catch(error => { console.error(error); process.exitCode = 1; });
