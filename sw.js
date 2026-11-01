// itsliventsev PWA — offline stands + dashboard, 2026 (v2)
const CACHE = 'itsliventsev-v3';
const PRECACHE = [
  '/', '/index.html',
  '/assets/workspace-tokens.css', '/assets/workspace.css', '/assets/workspace-home.css', '/assets/workspace-learning.css',
  '/assets/workspace.js', '/assets/i18n.js', '/assets/home-activity.js',
  '/assets/icons.svg', '/assets/favicon.svg',
  '/projects.html', '/articles.html', '/blog.html', '/archive.html',
  '/stands/index.html', '/faq.html', '/sitemap.html', '/site.webmanifest'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(()=>{})).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
// Stale-while-revalidate for same-origin GET, network-first for /commits API (GitHub) with 60s timeout
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Allow GitHub API via network-first (dashboard sparkline)
  if (url.hostname === 'api.github.com') {
    e.respondWith(fetch(e.request).then(resp => {
      if (resp.ok) caches.open(CACHE).then(c=>c.put(e.request, resp.clone()));
      return resp;
    }).catch(()=> caches.match(e.request)));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(cached => {
    const fetchPromise = fetch(e.request).then(resp => {
      if (resp.ok) { const clone = resp.clone(); caches.open(CACHE).then(c=>c.put(e.request, clone)); }
      return resp;
    }).catch(()=> cached || caches.match('/'));
    // v16: offline fallback — if both cache and network fail, show cached index
    return cached || fetchPromise;
  }));
});
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'GET_CACHE_SIZE') { e.waitUntil(caches.open(CACHE).then(c=>c.keys()).then(keys=> e.ports[0].postMessage({count: keys.length}))); }
  if (e.data && e.data.type === 'CLEAR_CACHE') { e.waitUntil(caches.delete(CACHE).then(()=> e.ports[0].postMessage({cleared:true}))); }
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
// legacy handler preserved below
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
