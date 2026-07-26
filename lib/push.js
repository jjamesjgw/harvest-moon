'use client';

// Web-push subscription writes go through the service-role /api/push route
// (session-gated), not the anon Supabase client — push_subs is no longer
// anon-writable. See app/api/push/route.js and the RLS lockdown migration.

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
  // player_id is derived from the session server-side; the `playerId` arg is
  // no longer sent (the route ignores any client-supplied id to prevent
  // forging another player's subscription).
  let res;
  try {
    res = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    });
  } catch (error) {
    return { ok: false, reason: 'persist-failed', error };
  }
  if (!res.ok) {
    let reason = 'persist-failed';
    try { const b = await res.json(); if (b?.error) reason = b.error; } catch {}
    return { ok: false, reason };
  }
  return { ok: true };
}

export async function disablePush() {
  if (typeof window === 'undefined') return { ok: true };
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    // Best-effort server delete; still unsubscribe locally even if it fails
    // (matches the prior behavior, which ignored the DB error).
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
