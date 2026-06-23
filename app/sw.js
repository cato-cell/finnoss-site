// FinnOss Service Worker v1.0
const CACHE_NAME = 'finnoss-v1';
const OFFLINE_URL = '/app/';

// Installer og cache grunnleggende ressurser
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/app/',
        '/app/manifest.json'
      ]);
    })
  );
  self.skipWaiting();
});

// Aktiver og rydd opp gamle cacher
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: nett først, fall tilbake til cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push-notifikasjoner
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'FinnOss Heggedal';
  const options = {
    body: data.body || 'Nytt lokalt tilbud venter deg',
    icon: '/images/pwa-icon-192.png',
    badge: '/images/pwa-icon-192.png',
    data: { url: data.url || '/app/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Klikk på notifikasjon åpner appen
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
