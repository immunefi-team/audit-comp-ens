/// <reference lib="webworker" />

/**
 * Push notification service worker.
 * Handles incoming push events and displays notifications.
 */

const sw = /** @type {ServiceWorkerGlobalScope} */ (self);

// activate immediately
sw.addEventListener('install', () => {
  sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim());
});

// handle incoming push notifications
sw.addEventListener('push', (event) => {
  const rawText = event.data?.text() ?? 'No payload';

  /** @type {string} */
  let title = 'ENS Notification';
  /** @type {string} */
  let body = rawText;
  /** @type {string | undefined} */
  let icon;
  /** @type {string | undefined} */
  let badge;
  /** @type {string | undefined} */
  let tag;
  /** @type {Record<string, unknown> | undefined} */
  let data;

  try {
    const payload = JSON.parse(rawText);
    title = payload.title ?? title;
    body = payload.body ?? body;
    icon = payload.icon;
    badge = payload.badge;
    tag = payload.tag;
    data = payload.data;
  } catch {
    // use raw text as body if not valid JSON
  }

  event.waitUntil(
    sw.registration.showNotification(title, {
      body,
      icon: icon ?? '/logo192.png',
      badge: badge ?? '/logo192.png',
      tag,
      data,
    })
  );
});

// handle notification click
sw.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url;

  if (url) {
    event.waitUntil(
      sw.clients.matchAll({ type: 'window' }).then((clientList) => {
        // try to focus existing window
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // open new window if none found
        if (sw.clients.openWindow) {
          return sw.clients.openWindow(url);
        }
      })
    );
  }
});
