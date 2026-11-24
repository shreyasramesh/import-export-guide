const CACHE_NAME = "import-export-v2";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Never intercept Gemini API calls or non-http(s) schemes
  if (url.origin === "https://generativelanguage.googleapis.com") return;
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Network-first for HTML navigations so updates arrive promptly, fallback to cache offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          }
          return res;
        })
        .catch(() => caches.match("/") || caches.match("/index.html"))
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetched = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetched;
      })
    );
  }
});
