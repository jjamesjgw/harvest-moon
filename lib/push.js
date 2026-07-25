'use client';
// Subscriptions are written through /api/push (service-role) rather than
// straight to Supabase with the anon key. The anon key ships in the browser
// bundle, so a world-writable push_subs table let anyone on the internet read
// every player's subscription secrets, delete them all, or insert a row
// claiming someone else's player_id to receive their targeted pushes. The
// route takes player_id from the signed session cookie instead.

// VAPID public key, base64-url encoded. Exposed to the browser at build time.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// 'unsupported' — browser lacks SW or PushManager (or no VAPID key configured)
// 'denied'      — user blocked notifications in browser settings
// 'subscribed'  — a pushManager subscription exists on this device
// 'available'   — supported and permitted (default/granted) but not subscribed
export async function getPushStatus() {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) {
    return 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'subscribed' : 'available';
}

export async function enablePush(playerId) {
  if (typeof window === 'undefined') return { ok: false, reason: 'unsupported' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) {
    return { ok: false, reason: 'unsupported' };
  }
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return { ok: false, reason: 'denied' };
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const { endpoint, keys } = sub.toJSON();
  // playerId is accepted for call-site compatibility but deliberately NOT
  // sent: the route derives it from the session cookie so a client can't
  // subscribe on another player's behalf.
  try {
    const res = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    });
    if (!res.ok) {
      return { ok: false, reason: res.status === 401 ? 'unauthorized' : 'persist-failed' };
    }
  } catch (error) {
    return { ok: false, reason: 'persist-failed', error };
  }
  return { ok: true };
}

export async function disablePush() {
  if (typeof window === 'undefined') return { ok: true };
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    // Drop the server-side row first; if that fails we still unsubscribe
    // locally so the device stops receiving, and /api/notify prunes rows that
    // return 404/410 on the next send.
    try {
      await fetch('/api/push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    } catch {}
    await sub.unsubscribe();
  }
  return { ok: true };
}
