// SÓCIO V002.2 — PWA offline e atualização segura do código.
const CACHE_NAME = 'socio-v0022-20261120';
const ASSETS = [
  './', './index.html', './css/style.css',
  './js/app.js', './js/updater.js', './js/store.js',
  './js/logic.js', './js/agenda.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];
const APP_PATHS = new Set(ASSETS.map(asset => new URL(asset, self.registration.scope).pathname));
const INDEX_URL = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', event => {
  // Não excluir caches de outros projetos que compartilham github.io.
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('socio-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // O manifesto da versão deve vir sempre da rede; nunca do cache.
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(request, {cache: 'no-store'}));
    return;
  }
  event.respondWith((async () => {
    const isNavigation = request.mode === 'navigate';
    const key = isNavigation ? INDEX_URL : request;
    try {
      // Prioriza código atualizado; uma falha no cache não bloqueia a página online.
      const response = await fetch(request, {cache: 'no-store'});
      if (response.ok && (isNavigation || APP_PATHS.has(url.pathname))) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(key, response.clone());
        } catch (cacheErr) { console.warn('SÓCIO: cache indisponível.', cacheErr); }
      }
      return response;
    } catch (err) {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(key);
        if (cached) return cached;
      } catch (_) { /* Sem cache offline. */ }
      return Response.error();
    }
  })());
});