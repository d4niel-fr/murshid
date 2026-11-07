/* Murshid service worker: opens offline after the first visit, and shows notifications on this device. */
const SHELL = 'murshid-shell-v2';
const PAGES = 'murshid-pages-v2';
const ASSETS = 'murshid-assets-v2';
const OFFLINE = '/offline.html';
const KEEP = [SHELL, PAGES, ASSETS];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll([OFFLINE, '/icon.svg', '/icons/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

/** Keep a cache from growing without limit (oldest entries go first). */
async function trim(name, max) {
  const c = await caches.open(name); const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // built files have a hash in their name and never change: cache first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/fonts/')) {
    e.respondWith(caches.open(ASSETS).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') { c.put(req, res.clone()); trim(ASSETS, 300); }
      return res;
    }));
    return;
  }

  // pages: network first; offline, the last copy of that page (your data stays on the device), else the offline page
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok && res.type === 'basic' && url.pathname.startsWith('/app')) { const copy = res.clone(); caches.open(PAGES).then((c) => { c.put(req, copy); trim(PAGES, 40); }); }
      return res;
    }).catch(async () => (await caches.match(req, { cacheName: PAGES })) || (await caches.match('/app', { cacheName: PAGES })) || caches.match(OFFLINE)));
  }
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'Murshid', body: e.data ? e.data.text() : '' }; }
  const title = String(data.title || 'Murshid').slice(0, 120);
  e.waitUntil(self.registration.showNotification(title, {
    body: String(data.body || '').slice(0, 240), icon: '/icons/icon-192.png', badge: '/icons/icon-maskable-192.png', tag: data.tag || undefined,
    data: { url: typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//') ? data.url : '/app' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/app';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (new URL(c.url).origin === self.location.origin && 'focus' in c) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
