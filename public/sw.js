// public/sw.js — Service Worker: PWA + Web Push
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Sengaja TIDAK mencegat request (dulu event.respondWith bikin "Failed to fetch").
// Handler kosong tetap memenuhi syarat installability PWA.
self.addEventListener('fetch', () => {});

/* ══════════ NOTIFIKASI PUSH ══════════ */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = {}; }

  const title = d.title || 'Invisual HRIS';
  const options = {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || 'invisual',
    renotify: true,
    vibrate: [90, 40, 90],
    data: { url: d.url || '/' },
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    // Titik/angka merah di ikon PWA (seperti WhatsApp)
    try {
      const list = await self.registration.getNotifications();
      if (self.navigator && self.navigator.setAppBadge) {
        await self.navigator.setAppBadge(list.length || 1);
      }
    } catch (e) { /* browser tak dukung badge */ }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil((async () => {
    try {
      if (self.navigator && self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
    } catch (e) { /* abaikan */ }

    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) {
        await c.focus();
        if (c.navigate) { try { await c.navigate(target); } catch (e) {} }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
