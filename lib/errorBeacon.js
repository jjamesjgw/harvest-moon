'use client';

// Minimal client crash reporter. The app has @vercel/analytics for page views
// but nothing that records errors, so the current failure mode is a friend
// texting "the app is broken" with zero diagnostic signal, on a phone the
// commissioner can't inspect. This posts crashes to /api/log, which console
// .errors them into the Vercel runtime logs — no new vendor, no new bundle.
//
// Deliberately small and defensive: a reporter that throws, floods, or blocks
// the UI would be worse than no reporter at all.

const MAX_REPORTS_PER_SESSION = 8;
let sent = 0;
const seen = new Set();
let installed = false;
let getContext = () => ({});

function truncate(v, n) {
  if (typeof v !== 'string') return undefined;
  return v.length > n ? v.slice(0, n) : v;
}

// Report one error. Safe to call from anywhere; never throws, never awaits.
export function reportError(kind, error, extra = {}) {
  try {
    if (typeof window === 'undefined') return;
    if (sent >= MAX_REPORTS_PER_SESSION) return;

    const message = truncate(String(error?.message || error || 'unknown'), 500);
    const stack = truncate(String(error?.stack || ''), 4000);

    // Dedupe on kind+message+first stack frame so a render loop that throws
    // every frame reports once instead of thousands of times.
    const sig = `${kind}|${message}|${(stack || '').split('\n')[1] || ''}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    sent++;

    let ctx = {};
    try { ctx = getContext() || {}; } catch {}

    const payload = JSON.stringify({
      kind,
      message,
      stack,
      screen: truncate(ctx.screen, 60),
      meId: truncate(ctx.meId, 60),
      url: truncate(window.location?.pathname, 200),
      ua: truncate(navigator?.userAgent, 300),
      ...extra,
    });

    // sendBeacon survives the page going away (the common case for a crash
    // followed by the user force-quitting); fetch+keepalive is the fallback.
    const blob = new Blob([payload], { type: 'application/json' });
    if (navigator.sendBeacon?.('/api/log', blob)) return;
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // A failing reporter must never become the error.
  }
}

// Install global handlers once. `context` is a function returning
// { screen, meId } so reports carry app state without this module importing it.
export function installErrorBeacon(context) {
  if (typeof window === 'undefined') return () => {};
  if (context) getContext = context;
  if (installed) return () => {};
  installed = true;

  const onError = (e) => reportError('window.onerror', e?.error || e?.message);
  const onRejection = (e) => reportError('unhandledrejection', e?.reason);

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    installed = false;
  };
}
