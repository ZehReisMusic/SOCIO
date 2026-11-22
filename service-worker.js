// MEU SÓCIO V003.21 — Painel com ondas e design system, PWA offline, atualização e Web Push (entrega preservada; clique contextual na Agenda).
const CACHE_NAME = 'socio-v00321-20261122';
const ASSETS = [
  './', './index.html', './css/style.css', './css/theme-v0032.css', './css/experience-v0033.css', './css/palette-v0036.css', './css/agenda-v0038.css', './css/reminders-v0039.css', './css/iphone-safe-area-v00311.css', './css/agenda-scheduling-v00312.css', './css/ios-input-focus-v00313.css', './css/agenda-datetime-v00315.css', './css/ios-modal-width-v00316.css', './css/agenda-native-picker-v00317.css', './css/push-time-mobile-v00318.css', './css/agenda-task-links-v00319.css', './css/time-aware-v00320.css', './css/task-voice-v00321.css', './assets/socio-waves.svg',
  './js/app.js', './js/updater.js', './js/push.js', './js/agenda-task-links.js', './js/time-aware.js', './js/task-voice.js', './js/store.js',
  './js/logic.js', './js/reizzor-station.js', './js/agenda.js', './js/agenda-overview.js', './js/appointment-reminders.js', './js/agenda-scheduling.js', './manifest.webmanifest',
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

// Exige uma notificação visível por evento push, inclusive se o app estiver fechado.
self.addEventListener('push', event => {
  let data={};
  try {data=event.data?.json()||{};} catch {data={};}
  const title='MEU SÓCIO';
  const rawBody=String(data.body||'Você tem um lembrete pendente.').slice(0,180);
  const isAgenda=rawBody.startsWith('Uma prioridade ficou pendente: Compromisso em ');
  const body=isAgenda?rawBody.slice('Uma prioridade ficou pendente: '.length):rawBody;
  event.waitUntil(self.registration.showNotification(title,{
    body,
    icon:'./icons/icon-192.png',
    badge:'./icons/icon-192.png',
    tag:isAgenda?'socio-agenda':(typeof data.tag==='string'&&data.tag==='socio-test'?'socio-test':'socio-priority'),
    data:{target:isAgenda?'agenda':'executar'}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const target=new URL(event.notification.data?.target==='agenda'?'./#agenda':'./#executar',self.registration.scope).href;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if(new URL(client.url).origin===self.location.origin&&new URL(client.url).pathname.startsWith(new URL(self.registration.scope).pathname)){
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
