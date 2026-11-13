/*
 * Retires the service worker of the previous (offline) version of qulearn.
 *
 * Browsers that used the old app still have it installed: it served cached
 * pages of the old app whenever the network was slow. Browsers re-check
 * /sw.js on every visit; when they fetch this file it replaces the old worker,
 * deletes every cache it made, unregisters itself and reloads open tabs, so
 * users land on the new app. The new app does not register a service worker.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })(),
  );
});
