/* سرویس‌ورکر سامانه — همیشه اول از شبکه می‌گیرد تا نسخهٔ قدیمی کش‌شده نمایش داده نشود */
const CACHE = 'samane-v14050709-3';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Dropbox و CDN دست‌نخورده
  e.respondWith((async () => {
    try {
      const net = await fetch(req, { cache: 'no-store' });
      if (net && net.ok) { const c = await caches.open(CACHE); c.put(req, net.clone()); }
      return net;
    } catch (err) {
      const hit = await caches.match(req) || await caches.match('index.html') || await caches.match('./');
      if (hit) return hit;
      throw err;
    }
  })());
});
