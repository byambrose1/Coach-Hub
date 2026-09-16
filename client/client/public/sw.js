// Minimal service worker: exists only to satisfy installability requirements
// (Android's install prompt requires a fetch handler) and to give the static
// app shell basic offline resilience. It deliberately never touches /api/
// requests - client, session, and booking data must always come straight
// from the network, never from a cache, or a coach could see stale
// availability or client info.
const CACHE_NAME = "practably-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls - always hit the network for live data.
  if (url.pathname.startsWith("/api/")) return;

  // Only handle same-origin GET requests for the static shell.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
