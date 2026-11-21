/* Film Lab offline support. The app and the film data are kept on the device after the first visit:
   the app itself is fetched fresh whenever there is a connection, the film data (luts) only when it changes. */
const V = 'filmlab-202611212349';
const CORE = ['./', 'index.html', 'js/app.js', 'js/gl.js', 'js/io.js', 'js/compose.js', 'manifest.webmanifest',
  'icons/favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'luts/index.json', 'luts/input_s24.json', 'luts/base.json', 'luts/portra-160.json', 'luts/portra-400.json', 'luts/portra-800.json', 'luts/gold-200.json', 'luts/ultramax-400.json', 'luts/ektar-100.json', 'luts/ektachrome-100.json', 'luts/kodachrome-64.json', 'luts/tri-x-400.json', 'luts/vision3-250d.json', 'luts/vision3-500t.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('filmlab-') && k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url), same = u.origin === self.location.origin;
  const font = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!same && !font) return;
  if (same && u.pathname.includes('/luts/')) {          // film data: from the device, fetched once per version
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(r); if (hit) return hit;
      const res = await fetch(r); if (res.ok) c.put(r, res.clone()); return res;
    }));
    return;
  }
  e.respondWith(fetch(r).then(res => {                    // the app and its fonts: fresh when online, kept for offline
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(V).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
