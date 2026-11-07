/* Offline PWA shell, including the third-party QR decoder's first-run cache. */
const CACHE_NAME='mochimono-v1.0.0';
const SHELL=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./vendor/qr-encode.js','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
const QR_READER='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
    const req=new Request(QR_READER,{mode:'no-cors'});
    const response=await fetch(req);
    if(!response || (!response.ok && response.type!=='opaque'))throw new Error('QR decoder unavailable');
    await cache.put(req,response);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys())if(name.startsWith('mochimono-')&&name!==CACHE_NAME)await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  const inScope=url.origin===self.location.origin && url.pathname.startsWith(new URL(self.registration.scope).pathname);
  if(!inScope && req.url!==QR_READER)return;
  event.respondWith((async()=>{
    const cached=await caches.match(req,{ignoreSearch:true});
    if(cached)return cached;
    try{
      const response=await fetch(req);
      if(response&&(response.ok||response.type==='opaque')){
        const cache=await caches.open(CACHE_NAME);await cache.put(req,response.clone());
      }
      return response;
    }catch(err){
      if(req.mode==='navigate'){
        const fallback=await caches.match('./index.html');if(fallback)return fallback;
      }
      throw err;
    }
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='OFFLINE_STATUS'||!event.ports?.[0])return;
  (async()=>{
    const cache=await caches.open(CACHE_NAME);
    const status=await Promise.all([cache.match('./index.html'),cache.match('./app.js'),cache.match(QR_READER)]);
    event.ports[0].postMessage({offlineReady:status.every(Boolean)});
  })();
});
