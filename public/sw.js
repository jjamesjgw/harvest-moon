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

  // Resolve the payload URL against our own origin and refuse anything that
  // escapes it. Payloads are server-generated today, but a notification tap
  // should never be able to navigate a window off-origin.
  const raw = event.notification.data?.url || '/';
  let target;
  try { target = new URL(raw, self.location.origin); } catch { target = new URL('/', self.location.origin); }
  if (target.origin !== self.location.origin) target = new URL('/', self.location.origin);

  // The app reads ?screen= on boot; for an already-open window we hand it the
  // screen id directly instead (see below).
  const screen = target.searchParams.get('screen');

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOrigin = wins.find((w) => {
      try { return new URL(w.url).origin === self.location.origin; } catch { return false; }
    });
    if (sameOrigin) {
      // Deliberately NOT sameOrigin.navigate(): navigating an already-open
      // window forces a full reload of the SPA (re-download the bundle,
      // re-fetch the league, replay the boot skeleton) just to reach a screen
      // the app can switch to in memory. On the highest-intent tap in the app
      // — "you're on the clock" during a live draft — that's the difference
      // between instant and several seconds. postMessage lets the running app
      // route itself; if no listener is attached (older client), the window
      // still focuses, which is no worse than before.
      if (screen) { try { sameOrigin.postMessage({ type: 'hm-navigate', screen }); } catch {} }
      return sameOrigin.focus();
    }
    // Cold start — the query param survives into the new window and the app
    // consumes it on boot.
    return self.clients.openWindow(target.href);
  })());
});
