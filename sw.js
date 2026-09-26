// Sin conexion: la app y la muestra se guardan al abrirla; las portadas de la
// muestra, segun se ven. Los guardados de cada uno no pasan por aqui: viven en
// IndexedDB (store.js). Todo va "red primero": con conexion, la ultima version.
const SHELL = "shell-v12";
const FILES = ["./", "index.html", "app.css", "app.js", "search.js", "rules.js", "store.js",
  "rules-data.json", "bookmarklet.js", "bookmarklet-tiktok.js", "demo/posts.json", "manifest.webmanifest", "vendor/jsQR.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== "covers-v1").map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/sync/")) return;  // paquetes del Mac: los guarda store.js, no esta cache

  if (url.pathname.includes("/covers/")) {
    e.respondWith(caches.open("covers-v1").then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }

  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
