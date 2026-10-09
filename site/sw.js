// 한 번 열면 전파가 약한 곳에서도 볼 수 있도록 저장해 둔다.
var CACHE = "dog-guide-__BUILD__";
var SHELL = ["./", "index.html", "assets/style.css", "assets/app.js", "assets/icon.svg", "manifest.webmanifest", "data.json"];
var IMAGES = __IMAGES__;

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL.concat(IMAGES)); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  var isData = /data\.json$/.test(new URL(e.request.url).pathname);
  if (isData) {
    // 자료는 최신 우선, 연결이 없으면 저장본
    e.respondWith(fetch(e.request).then(function (r) {
      var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put("data.json", copy); }); return r;
    }).catch(function () { return caches.match("data.json"); }));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) { return hit || fetch(e.request); }));
});
