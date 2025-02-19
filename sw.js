/* eslint-env serviceworker */

const SW_VERSION = "2.1.0";
const BASE_PATH = '/GameSalad/';

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
      .then(() => self.clients.claim())
  );
});

// Handle push notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Game Salad", {
      body: data.body || "New update available!",
      icon: `${BASE_PATH}assets/icon_tr.png`,
      badge: `${BASE_PATH}assets/icon.png`,
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
