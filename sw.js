/* v1.5.1 cache repair: replace old app caches without touching localStorage. */
const CACHE_NAME='mochimochi-v1.5.1';
const LOCAL=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
const LIBRARIES=[
  'https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(LOCAL.map(url=>new Request(url,{cache:'reload'})));
    // Libraries are optional during install; the page also fetches them on first online visit.
    await Promise.allSettled(LIBRARIES.map(async url=>{
      const response=await fetch(url,{mode:'no-cors'});
      await cache.put(url,response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name!==CACHE_NAME &&
      (name.startsWith('mochimono-')||name.startsWith('mochimochi-'))).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    if(req.mode==='navigate'){
      try{const online=await fetch(req);if(online.ok) await cache.put('./index.html',online.clone());return online;}
      catch(e){return (await cache.match('./index.html')) || Response.error();}
    }
    if(req.url.includes('/app.js') || req.url.includes('/style.css') || req.url.endsWith('/manifest.webmanifest')){
      try{const online=await fetch(req);if(online.ok) await cache.put(req,online.clone());return online;}
      catch(e){return (await cache.match(req))||Response.error();}
    }
    const cached=await cache.match(req);
    if(cached)return cached;
    try{const online=await fetch(req); if(online.ok || online.type==='opaque') await cache.put(req,online.clone());return online;}
    catch(e){return Response.error();}
  })());
});
