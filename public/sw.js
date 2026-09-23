const CACHE = 'master-check-static-v1';
const STATIC = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('master-check-static-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
// Never cache authenticated pages, APIs, photos, or financial data.
self.addEventListener('fetch', event => {
 if (event.request.method !== 'GET') return;
 if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});
