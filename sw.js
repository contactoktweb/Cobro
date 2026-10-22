// Guarda la app en el dispositivo para que abra sin internet.
const CACHE = "kt-cobros-v2";
const FILES = ["./", "index.html", "manifest.webmanifest", "lib/jszip.min.js", "lib/html2canvas.min.js", "lib/jspdf.umd.min.js", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.endsWith("/config.js")) return; // Groq, Ollama y config.js van directo
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request, {ignoreSearch: true})));
});
