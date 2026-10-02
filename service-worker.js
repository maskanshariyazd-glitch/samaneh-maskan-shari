/* سرویس‌ورکر سامانه — v14050709-6
   - صفحه و کتابخانه‌ها فوراً از حافظهٔ گوشی باز می‌شوند (سریع، حتی با اینترنت ضعیف) و هم‌زمان در پس‌زمینه نسخهٔ جدید گرفته می‌شود
   - اگر نسخهٔ جدیدی روی سرور باشد، به صفحه پیام داده می‌شود تا خودکار/با یک لمس به‌روز شود */
const CACHE = 'samane-v14050709-6';
const PRECACHE = ['./', 'index.html', 'manifest.json', 'icon-192.png',
  'leaflet.js', 'leaflet.css', 'xlsx.full.min.js', 'exceljs.min.js', 'chart.umd.js', 'layers.png'];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async u => { try { const r = await fetch(u, { cache: 'reload' }); if (r && r.ok) await c.put(u, r); } catch (_) {} }));
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function differs(oldR, newR) {
  const g = (r, h) => r.headers.get(h) || '';
  const e1 = g(oldR, 'etag'), e2 = g(newR, 'etag');
  if (e1 || e2) return e1 !== e2;
  const l1 = g(oldR, 'last-modified'), l2 = g(newR, 'last-modified');
  if (l1 || l2) return l1 !== l2;
  const [a, b] = await Promise.all([oldR.clone().arrayBuffer(), newR.clone().arrayBuffer()]);
  return a.byteLength !== b.byteLength;
}
async function notify() {
  const cs = await self.clients.matchAll({ type: 'window' });
  cs.forEach(c => c.postMessage({ type: 'NEW_VERSION' }));
}
function keyFor(req, url) {
  const isDoc = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  return isDoc ? new Request(url.origin + url.pathname) : req;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // کتابخانه‌های بیرونی (نسخهٔ ثابت): اول حافظه
  if (url.origin !== location.origin) {
    if (!CDN_HOSTS.includes(url.hostname)) return;
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      const net = await fetch(req);
      try { c.put(req, net.clone()); } catch (_) {}
      return net;
    })());
    return;
  }

  // فایل‌های خود برنامه: فوری از حافظه + به‌روزرسانی در پس‌زمینه
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const key = keyFor(req, url);
    const isDoc = key !== req;
    const hit = await c.match(key, { ignoreSearch: !isDoc ? false : true });
    const refresh = fetch(isDoc ? url.origin + url.pathname : req, { cache: 'no-store' }).then(async net => {
      if (net && net.ok) {
        let changed = false;
        if (isDoc && hit) { try { changed = await differs(hit, net.clone()); } catch (_) {} }
        await c.put(key, net.clone());
        if (changed) notify();
      }
      return net;
    }).catch(() => null);
    if (hit) { e.waitUntil(refresh); return hit; }
    const net = await refresh;
    if (net) return net;
    const fb = await c.match('index.html') || await c.match('./');
    if (fb && isDoc) return fb;
    return new Response('آفلاین', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
