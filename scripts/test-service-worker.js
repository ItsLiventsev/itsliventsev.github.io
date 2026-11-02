'use strict';
// Run with Node 18+: node scripts/test-service-worker.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const listeners = {};
const stores = new Map([['unrelated-app', new Map()], ['itsliventsev-v7', new Map()], ['itsliventsev-v7-runtime', new Map()], ['itsliventsev-v8', new Map()], ['itsliventsev-v8-runtime', new Map()], ['itsliventsev-v9', new Map()], ['itsliventsev-v9-runtime', new Map()], ['itsliventsev-v10', new Map()], ['itsliventsev-v10-runtime', new Map()]]);
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
  assert(stores.get('itsliventsev-v11').has(normalize('/index.html'))); // one failed file does not discard the rest
  await lifecycle('activate'); assert(claimed); assert(!stores.has('itsliventsev-v7')); assert(!stores.has('itsliventsev-v7-runtime')); assert(!stores.has('itsliventsev-v8')); assert(!stores.has('itsliventsev-v8-runtime')); assert(!stores.has('itsliventsev-v9')); assert(!stores.has('itsliventsev-v9-runtime')); assert(!stores.has('itsliventsev-v10')); assert(!stores.has('itsliventsev-v10-runtime')); assert(stores.has('unrelated-app'));
  let response = await request('https://site.test/missing.js');
  assert.equal(response.status, 503); assert.match(response.headers.get('content-type'), /text\/plain/);
  response = await request('https://site.test/assets/workspace.css?v=20261102r1'); assert.equal(await response.text(), '/assets/workspace.css');
  response = await request('https://site.test/assets/workspace.css?v=20261102r1&other=2'); assert.equal(response.status, 503);
  response = await request('https://site.test/unknown', 'navigate'); assert.equal(await response.text(), '/assets/offline.html');
  assert.equal(await request('https://api.github.com/repos/example'), null);
  network = async () => new Response('fresh');
  for (let i = 0; i < 130; i++) await request('https://site.test/test-' + i + '.js');
  assert.equal(stores.get('itsliventsev-v11-runtime').size, 120);
  assert(!stores.get('itsliventsev-v11-runtime').has(normalize('/test-0.js')));
  network = async () => { throw Error('offline'); };
  response = await request('https://site.test/test-129.js'); assert.equal(await response.text(), 'fresh');
  response = await request('https://site.test/blog/posts.json'); assert.equal(await response.text(), '/blog/posts.json');
  response = await request('https://site.test/assets/home-reading.js?v=20261102r1'); assert.equal(await response.text(), '/assets/home-reading.js');
  response = await request('https://site.test/assets/workspace.js?v=new'); assert.equal(await response.text(), '/assets/workspace.js');
  assert((await message('GET_CACHE_SIZE')).count > 120);
  assert((await message('CLEAR_CACHE')).cleared);
  response = await request('https://site.test/unknown', 'navigate'); assert.equal(await response.text(), '/assets/offline.html');
  response = await request('https://site.test/test-129.js'); assert.equal(response.status, 503);
  console.log('Service worker: bounded runtime cache, isolation and offline shell OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
