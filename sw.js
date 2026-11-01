// itsliventsev PWA — offline stands, 2026
const CACHE = 'itsliventsev-v1';
const PRECACHE = [
  '/', '/index.html',
  '/assets/workspace-tokens.css', '/assets/workspace.css', '/assets/workspace-home.css', '/assets/workspace-learning.css',
  '/assets/workspace.js', '/assets/i18n.js', '/assets/home-activity.js',
  '/assets/icons.svg', '/assets/favicon.svg',
  '/projects.html', '/articles.html', '/blog.html', '/archive.html',
  '/stands/index.html', '/site.webmanifest'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(()=>{})).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(cached => {
    const fetchPromise = fetch(e.request).then(resp => {
      if (resp.ok) { const clone = resp.clone(); caches.open(CACHE).then(c=>c.put(e.request, clone)); }
      return resp;
    }).catch(()=> cached || caches.match('/'));
    return cached || fetchPromise;
  }));
});
