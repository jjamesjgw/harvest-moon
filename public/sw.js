// Harvest Moon service worker.
// Receives Web Push messages from /api/notify and shows a system notification.
// Tap on the notification focuses any open tab on this origin, or opens a new
// one at the URL the push payload specifies (defaults to "/").

self.addEventListener('push', (event) => {
  const data = (() => {
    try { return event.data?.json() ?? {}; } catch { return {}; }
  })();

  const title = data.title || 'Harvest Moon';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    tag: data.tag,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOrigin = wins.find((w) => new URL(w.url).origin === self.location.origin);
    if (sameOrigin) {
      try { await sameOrigin.navigate(targetUrl); } catch {}
      return sameOrigin.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});
