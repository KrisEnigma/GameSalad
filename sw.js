/* eslint-env serviceworker */

const SW_VERSION = "2.1.0";
const BASE_PATH = self.registration.scope;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        // Limpiar cualquier caché antigua
        return Promise.all(cacheNames.map((name) => caches.delete(name)));
      })
      .then(() => {
        // Notificar a los clientes que se ha limpiado el caché
        return self.clients.matchAll().then((clients) => {
          clients.forEach(client => {
            client.postMessage({ type: 'CACHE_CLEARED', reload: true });
          });
        });
      })
      .then(() => self.clients.claim())
  );
});

// Handle push notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Game Salad", {
      body: data.body || "New update available!",
      icon: new URL("assets/icon_tr.png", BASE_PATH).href,
      badge: new URL("assets/icon.png", BASE_PATH).href,
      vibrate: [200, 100, 200],
      data: { url: data.url || BASE_PATH },
    })
  );
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clients) => {
      const client = clients.find((c) => c.url === event.notification.data.url);
      return client
        ? client.focus()
        : clients.openWindow(event.notification.data.url);
    })
  );
});
