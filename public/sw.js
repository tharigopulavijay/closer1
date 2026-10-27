const CACHE = "closer-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"];

function isAppShell(url) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname;
  if (path.startsWith("/api") || path.startsWith("/media")) return false;
  return path === "/" || path === "/index.html" || path === "/manifest.webmanifest" || path === "/favicon.svg" || path.startsWith("/assets/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !isAppShell(url)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(event.request);
        if (fresh.ok) await cache.put(event.request, fresh.clone());
        return fresh;
      } catch {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        return (await cache.match("/")) || Response.error();
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "Closer", body: "The Drop is open." };
  event.waitUntil(self.registration.showNotification(data.title || "Closer", { body: data.body || "The Drop is open.", icon: "/favicon.svg" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/drop"));
});
