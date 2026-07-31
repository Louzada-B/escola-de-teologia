/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute } from 'workbox-precaching';

// Precache gerado pelo vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);

// Handler de push notifications
self.addEventListener('push', (event) => {
  let data: Record<string, string> = {};
  try { data = event.data?.json() ?? {}; } catch {}

  const title = data.title || 'Formação Teológica BC';
  const body  = data.body  || 'Você tem uma nova notificação.';
  const icon  = data.icon  || '/pwa-192x192.png';
  const url   = data.url   || '/dashboard/avisos';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/pwa-192x192.png',
      data: { url },
      requireInteraction: false,
    })
  );
});

// Ao clicar na notificação, abre a URL correspondente
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      self.clients.openWindow(url);
    })
  );
});
