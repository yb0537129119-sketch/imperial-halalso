const CACHE='imperial-halls-v14';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./imperial-logo.png','./ballroom-bg.jpg'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('imperial-halls-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response && response.ok && new URL(event.request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});

self.addEventListener('push',event=>{
 let data={title:"אולמי אימפריאל",body:"התקבלה בקשת חזרה חדשה",url:"/"};
 try{if(event.data)data={...data,...event.data.json()};}catch(e){}
 event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:"./icon.svg",badge:"./icon.svg",data:{url:data.url||"/"},tag:"imperial-callback",renotify:true}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL(event.notification.data?.url||"/",self.location.origin).href;
 event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
  for(const client of list){if(new URL(client.url).origin===self.location.origin){client.navigate(target);return client.focus();}}
  return self.clients.openWindow(target);
 }));
});
