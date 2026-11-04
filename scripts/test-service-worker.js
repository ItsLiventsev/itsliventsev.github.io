'use strict';
// Run with Node 18+: node scripts/test-service-worker.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const listeners = {};
const stores = new Map([['unrelated-app', new Map()], ['itsliventsev-v7', new Map()], ['itsliventsev-v7-runtime', new Map()], ['itsliventsev-v8', new Map()], ['itsliventsev-v8-runtime', new Map()], ['itsliventsev-v9', new Map()], ['itsliventsev-v9-runtime', new Map()], ['itsliventsev-v10', new Map()], ['itsliventsev-v10-runtime', new Map()], ['itsliventsev-v11', new Map()], ['itsliventsev-v11-runtime', new Map()], ['itsliventsev-v12', new Map()], ['itsliventsev-v12-runtime', new Map()], ['itsliventsev-v13', new Map()], ['itsliventsev-v13-runtime', new Map()], ['itsliventsev-v14', new Map()], ['itsliventsev-v14-runtime', new Map()], ['itsliventsev-v19', new Map()], ['itsliventsev-v19-runtime', new Map()], ['itsliventsev-v20', new Map()], ['itsliventsev-v20-runtime', new Map()], ['itsliventsev-v21', new Map()], ['itsliventsev-v21-runtime', new Map()], ['itsliventsev-v22', new Map()], ['itsliventsev-v22-runtime', new Map()], ['itsliventsev-v23', new Map()], ['itsliventsev-v23-runtime', new Map()], ['itsliventsev-v24', new Map()], ['itsliventsev-v24-runtime', new Map()], ['itsliventsev-v25', new Map()], ['itsliventsev-v29', new Map()], ['itsliventsev-v29-runtime', new Map()], ['itsliventsev-v30', new Map()], ['itsliventsev-v30-runtime', new Map()], ['itsliventsev-v31', new Map()], ['itsliventsev-v31-runtime', new Map()], ['itsliventsev-v32', new Map()], ['itsliventsev-v32-runtime', new Map()], ['itsliventsev-v33', new Map()], ['itsliventsev-v33-runtime', new Map()], ['itsliventsev-v34', new Map()], ['itsliventsev-v34-runtime', new Map()], ['itsliventsev-v35', new Map()], ['itsliventsev-v35-runtime', new Map()], ['itsliventsev-v36', new Map()], ['itsliventsev-v36-runtime', new Map()], ['itsliventsev-v37', new Map()], ['itsliventsev-v37-runtime', new Map()], ['itsliventsev-v38', new Map()], ['itsliventsev-v38-runtime', new Map()]]);
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
  assert(stores.get('itsliventsev-v39').has(normalize('/index.html'))); // one failed file does not discard the rest
  await lifecycle('activate'); assert(claimed); assert(!stores.has('itsliventsev-v7')); assert(!stores.has('itsliventsev-v7-runtime')); assert(!stores.has('itsliventsev-v8')); assert(!stores.has('itsliventsev-v8-runtime')); assert(!stores.has('itsliventsev-v9')); assert(!stores.has('itsliventsev-v9-runtime')); assert(!stores.has('itsliventsev-v10')); assert(!stores.has('itsliventsev-v10-runtime')); assert(!stores.has('itsliventsev-v11')); assert(!stores.has('itsliventsev-v11-runtime')); assert(!stores.has('itsliventsev-v12')); assert(!stores.has('itsliventsev-v12-runtime')); assert(!stores.has('itsliventsev-v13')); assert(!stores.has('itsliventsev-v13-runtime')); assert(!stores.has('itsliventsev-v14')); assert(!stores.has('itsliventsev-v14-runtime')); assert(!stores.has('itsliventsev-v15')); assert(!stores.has('itsliventsev-v15-runtime')); assert(!stores.has('itsliventsev-v17')); assert(!stores.has('itsliventsev-v17-runtime')); assert(!stores.has('itsliventsev-v18')); assert(!stores.has('itsliventsev-v19')); assert(!stores.has('itsliventsev-v19-runtime')); assert(!stores.has('itsliventsev-v20')); assert(!stores.has('itsliventsev-v20-runtime')); assert(!stores.has('itsliventsev-v21')); assert(!stores.has('itsliventsev-v21-runtime')); assert(!stores.has('itsliventsev-v22')); assert(!stores.has('itsliventsev-v22-runtime')); assert(!stores.has('itsliventsev-v23')); assert(!stores.has('itsliventsev-v23-runtime')); assert(!stores.has('itsliventsev-v24')); assert(!stores.has('itsliventsev-v24-runtime')); assert(!stores.has('itsliventsev-v18-runtime')); assert(!stores.has('itsliventsev-v25')); assert(!stores.has('itsliventsev-v25-runtime')); assert(!stores.has('itsliventsev-v26')); assert(!stores.has('itsliventsev-v26-runtime')); assert(!stores.has('itsliventsev-v27')); assert(!stores.has('itsliventsev-v27-runtime')); assert(!stores.has('itsliventsev-v28')); assert(!stores.has('itsliventsev-v28-runtime')); assert(!stores.has('itsliventsev-v29')); assert(!stores.has('itsliventsev-v29-runtime')); assert(!stores.has('itsliventsev-v30')); assert(!stores.has('itsliventsev-v30-runtime')); assert(!stores.has('itsliventsev-v31')); assert(!stores.has('itsliventsev-v31-runtime')); assert(!stores.has('itsliventsev-v32')); assert(!stores.has('itsliventsev-v32-runtime')); assert(!stores.has('itsliventsev-v33')); assert(!stores.has('itsliventsev-v33-runtime')); assert(!stores.has('itsliventsev-v34')); assert(!stores.has('itsliventsev-v34-runtime')); assert(!stores.has('itsliventsev-v35')); assert(!stores.has('itsliventsev-v35-runtime')); assert(!stores.has('itsliventsev-v36')); assert(!stores.has('itsliventsev-v36-runtime')); assert(!stores.has('itsliventsev-v37')); assert(!stores.has('itsliventsev-v37-runtime')); assert(!stores.has('itsliventsev-v38')); assert(!stores.has('itsliventsev-v38-runtime')); assert(stores.has('unrelated-app'));
  let response = await request('https://site.test/missing.js');
  assert.equal(response.status, 503); assert.match(response.headers.get('content-type'), /text\/plain/);
  response = await request('https://site.test/assets/base.css?v=1'); assert.equal(await response.text(), '/assets/base.css');
  response = await request('https://site.test/assets/base.css?v=1&other=2'); assert.equal(response.status, 503);
  response = await request('https://site.test/unknown', 'navigate'); assert.equal(await response.text(), '/assets/offline.html');
  assert.equal(await request('https://api.github.com/repos/example'), null);
  network = async () => new Response('fresh');
  for (let i = 0; i < 130; i++) await request('https://site.test/test-' + i + '.js');
  assert.equal(stores.get('itsliventsev-v39-runtime').size, 120);
  assert(!stores.get('itsliventsev-v39-runtime').has(normalize('/test-0.js')));
  network = async () => { throw Error('offline'); };
  response = await request('https://site.test/test-129.js'); assert.equal(await response.text(), 'fresh');
  response = await request('https://site.test/blog/posts.json'); assert.equal(await response.text(), '/blog/posts.json');
  response = await request('https://site.test/assets/home-reading.js?v=20261102r2'); assert.equal(await response.text(), '/assets/home-reading.js');
  response = await request('https://site.test/assets/shell.js?v=new'); assert.equal(await response.text(), '/assets/shell.js');
  assert((await message('GET_CACHE_SIZE')).count > 120);
  assert((await message('CLEAR_CACHE')).cleared);
  response = await request('https://site.test/unknown', 'navigate'); assert.equal(await response.text(), '/assets/offline.html');
  response = await request('https://site.test/test-129.js'); assert.equal(response.status, 503);
  console.log('Service worker: bounded runtime cache, isolation and offline shell OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
