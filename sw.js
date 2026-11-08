const CACHE = 'mochimochi-mochimono-v15-cache';
const PRECACHE = [
  './','./index.html','./style.css','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE.map(url => new Request(url,{mode:'no-cors'}))))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(resp => { const copy = resp.clone(); caches.open(CACHE).then(c => c.put(event.request, copy)); return resp; }).catch(()=> hit)));
});
