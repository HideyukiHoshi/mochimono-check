/* もちもちもちもの: versioned offline cache / network-first application files */
const CACHE_NAME='mochimochi-v1.6.0';
const CORE=['./','./index.html','./style.css?v=160','./app.js?v=160','./qr-core.js?v=160','./manifest.webmanifest?v=160','./icon-192.png?v=160','./icon-512.png?v=160','./apple-touch-icon.png?v=160'];
const OPTIONAL=['https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(CORE.map(url=>new Request(url,{cache:'reload'})));
    await Promise.allSettled(OPTIONAL.map(async url=>{
      const resp=await fetch(url,{mode:'no-cors'});
      if(resp.ok || resp.type==='opaque')await cache.put(url,resp);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name!==CACHE_NAME && (name.startsWith('mochimono-')||name.startsWith('mochimochi-'))).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith((async()=>{
    const req=event.request;
    const cache=await caches.open(CACHE_NAME);
    const url=new URL(req.url);
    if(url.origin===self.location.origin && (req.mode==='navigate'|| /\.(?:js|css|webmanifest)$/i.test(url.pathname))){
      try{
        const resp=await fetch(req,{cache:'no-store'});
        if(resp.ok)await cache.put(req,resp.clone());
        return resp;
      }catch(e){return (await cache.match(req))||(req.mode==='navigate'?await cache.match('./index.html'):null)||Response.error();}
    }
    const cached=await cache.match(req);
    if(cached)return cached;
    try{
      const resp=await fetch(req);
      if(resp.ok||resp.type==='opaque')await cache.put(req,resp.clone());
      return resp;
    }catch(e){return Response.error();}
  })());
});
