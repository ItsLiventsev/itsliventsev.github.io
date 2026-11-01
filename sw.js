// Offline cache for the site. Keep cache names scoped to this application.
const CACHE = 'itsliventsev-v5';
const PRECACHE = [
  '/', '/index.html',
  '/assets/workspace-tokens.css', '/assets/workspace.css', '/assets/workspace-home.css', '/assets/workspace-learning.css',
  '/assets/workspace.js', '/assets/i18n.js', '/assets/home-activity.js',
  '/assets/icons.svg', '/assets/favicon.svg',
  '/projects.html', '/articles.html', '/blog.html', '/archive.html',
  '/stands/index.html', '/faq.html', '/sitemap.html', '/site.webmanifest'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache =>
    Promise.allSettled(PRECACHE.map(url => cache.add(url)))
  ).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('itsliventsev-v') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

// Network first avoids serving a new document with obsolete scripts and styles.
// Cross-origin requests (including GitHub API) are left to the browser.
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
      }
      return response;
    } catch (_) {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const home = await cache.match('/index.html') || await cache.match('/');
        if (home) return home;
      }
      // Never respond to an unavailable JS/CSS/image request with HTML.
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'GET_CACHE_SIZE' && event.ports[0]) {
    event.waitUntil(caches.open(CACHE).then(cache => cache.keys()).then(keys => event.ports[0].postMessage({count: keys.length})));
  }
  if (event.data && event.data.type === 'CLEAR_CACHE' && event.ports[0]) {
    event.waitUntil(caches.delete(CACHE).then(() => event.ports[0].postMessage({cleared: true})));
  }
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
