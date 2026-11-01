// Offline cache for the site. Keep cache names scoped to this application.
const CACHE = 'itsliventsev-v7';
const PRECACHE = [
  '/', '/index.html', '/assets/offline.html',
  '/assets/workspace-tokens.css', '/assets/workspace.css', '/assets/workspace-home.css', '/assets/workspace-learning.css',
  '/assets/workspace.js', '/assets/i18n.js', '/assets/home-activity.js', '/assets/site.js', '/assets/shared-chrome.js',
  '/assets/search-index.json',
  '/assets/fonts/manrope-cyrillic-wght-normal.woff2', '/assets/fonts/manrope-latin-wght-normal.woff2',
  '/assets/fonts/jetbrains-mono-cyrillic-wght-normal.woff2', '/assets/fonts/jetbrains-mono-latin-wght-normal.woff2',
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
        await caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    } catch (_) {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      // HTML uses ?v= cache busters while the installation cache uses clean paths.
      if (url.pathname.startsWith('/assets/') && /\.(?:js|css)$/.test(url.pathname) && url.searchParams.has('v') && [...url.searchParams.keys()].every(key => key === 'v')) {
        const versionless = await cache.match(url.pathname);
        if (versionless) return versionless;
      }
      if (request.mode === 'navigate') {
        const offline = await cache.match('/assets/offline.html');
        if (offline) return offline;
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
