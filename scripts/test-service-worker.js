'use strict';
// Run with Node 18+: node scripts/test-service-worker.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const listeners = {};
const stores = new Map([['unrelated-app', new Map()], ['itsliventsev-v4', new Map()], ['itsliventsev-v5', new Map()]]);
const cache = {
  async add(url) { if (url === '/faq.html') throw Error('unavailable'); stores.get('itsliventsev-v6').set(url, new Response(url)); },
  async put(request, response) { stores.get('itsliventsev-v6').set(typeof request === 'string' ? request : request.url, response); },
  async match(request) { return stores.get('itsliventsev-v6').get(typeof request === 'string' ? request : request.url); },
  async keys() { return [...stores.get('itsliventsev-v6').keys()]; }
};
const caches = {
  async open(name) { if (!stores.has(name)) stores.set(name, new Map()); return cache; },
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); }
};
let network = async () => { throw Error('offline'); };
let skipped = false, claimed = false;
const self = { addEventListener(type, fn) { listeners[type] = fn; }, skipWaiting() { skipped = true; }, clients: { claim() { claimed = true; } } };
vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), { self, caches, URL, Response, location: { origin: 'https://site.test' }, fetch: (...args) => network(...args), Promise });
async function lifecycle(type) { let wait; listeners[type]({ waitUntil(p) { wait = p; } }); await wait; }
async function request(url, mode = 'cors') {
  let result; const pending = [];
  listeners.fetch({ request: { url, mode, method: 'GET' }, respondWith(p) { result = p; }, waitUntil(p) { pending.push(p); } });
  if (!result) return null;
  const response = await result; await Promise.all(pending); return response;
}
(async () => {
  await lifecycle('install'); assert(skipped);
  assert(stores.get('itsliventsev-v6').has('/index.html')); // one failed file does not discard the rest
  await lifecycle('activate'); assert(claimed); assert(!stores.has('itsliventsev-v4')); assert(!stores.has('itsliventsev-v5')); assert(stores.has('unrelated-app'));
  let response = await request('https://site.test/missing.js');
  assert.equal(response.status, 503); assert.match(response.headers.get('content-type'), /text\/plain/);
  response = await request('https://site.test/unknown', 'navigate'); assert.equal(await response.text(), '/assets/offline.html');
  assert.equal(await request('https://api.github.com/repos/example'), null);
  network = async () => new Response('fresh');
  response = await request('https://site.test/test.js'); assert.equal(await response.text(), 'fresh');
  network = async () => { throw Error('offline'); };
  response = await request('https://site.test/test.js'); assert.equal(await response.text(), 'fresh');
  console.log('Service worker: install, cache isolation, online/offline and asset fallback OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
