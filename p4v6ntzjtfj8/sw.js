// Apex offline support: app shell works without signal; live data always goes to the network.
var CACHE = 'apex-v4';
self.addEventListener('install', function (e) { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(['./', './index.html', './manifest.json']); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (/\/mkt$/.test(url.pathname)) return; // live market data: never serve from cache
  if (/\/s\/[a-f0-9]+\.json$/.test(url.pathname)) return; // private import files: always from the network
  if (/\/files\//.test(url.pathname)) return; // encrypted attachments: never cached by the service worker
  if (/firebaseio\.com|coingecko\.com|script\.google|googleusercontent|tessdata|jsdelivr/.test(url.host + url.pathname) && !/cloudfront/.test(url.host)) return;
  if (req.mode === 'navigate') {
    // Fresh page when the network answers quickly; otherwise open instantly from the saved copy (and refresh it in the background).
    var net = fetch(req).then(function (r) { if (r && r.ok) { var c = r.clone(); caches.open(CACHE).then(function (ca) { ca.put('./index.html', c); }); } return r; });
    e.respondWith(caches.match('./index.html').then(function (hit) {
      if (!hit) return net;
      var slow = new Promise(function (res) { setTimeout(function () { res(hit); }, 1200); });
      return Promise.race([net.catch(function () { return hit; }), slow]);
    }));
    e.waitUntil(net.catch(function () {}));
    return;
  }
  if (url.origin === location.origin || /cloudfront\.net|fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (r) { if (r && (r.ok || r.type === 'opaque')) { var c = r.clone(); caches.open(CACHE).then(function (ca) { ca.put(req, c); }); } return r; }).catch(function () { return hit; });
      return hit || net;
    }));
  }
});
