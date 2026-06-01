# Save Banner Breadcrumb — Design

**Date:** 2026-05-17
**Status:** Approved for implementation planning

## Goal

When the `SaveBanner` in `components/ui/primitives.jsx` shows an error to a user, emit a structured breadcrumb to two places:

1. The browser console (always — for local devtools repro).
2. Vercel runtime logs (when the network is up — for remote diagnosis from any user, especially mobile).

The breadcrumb names the failure category (one of `session`/`network`/`server`/`app-bug`/`unknown`) and the raw error message that drove it. Future incidents like the 2026-05-17 service-role-key outage become "search Vercel logs for `[client-log]`" instead of an hour of Postgres log archaeology.

## Background

The SaveBanner already classifies errors into five categories with distinct user-facing copy (see `categorizeSaveError` in `components/ui/primitives.jsx`). The categories work for users. They are invisible to the developer — when a teammate reports "I got the red banner," there's no log saying which category fired or what the underlying error was.

The 2026-05-17 incident hit the `unknown` category because the route handler bubbled up an RLS error message that didn't match any keyword in the classifier. The user-facing copy ("Saves aren't going through right now") was correct, but the lack of a breadcrumb meant the developer had to correlate Vercel HTTP logs with Supabase Postgres logs to find the actual cause. A single `[client-log] kind=save-banner ... category=unknown message="new row violates row-level security policy ..."` line would have collapsed that hour into a search.

## Non-goals

- No replacement or expansion of the existing five user-facing categories. The copy is good; that part of the original Task #6 is closed.
- No threading of structured `error.code` through `useLeague` → `SaveBanner`. The current string-based classification is fine for now; revisit if a fourth `/api/league` error code is added without a matching keyword.
- No rate limiting on the log endpoint. For 6 users gated by `hm_session`, abuse is not a concern.
- No PII redaction. The 6-user audience means the player name (from session) and the raw error message are fine to log.
- No retention or query-side tooling beyond what Vercel runtime logs already provide.
- No additional client kinds beyond `save-banner` in this work. Future breadcrumbs (draft errors, push subscribe failures) can reuse the endpoint with new kinds, but they are not part of this spec.

## Architecture

```
┌────────────────────┐
│ SaveBanner mounts in │
│ status='error' state │
└────────┬───────────┘
           │  once per (category, error) tuple
           ├──────────────────────► console.warn('[save-banner]', {category, message})
           │                                  (always — no network dependency)
           │
           └─►  POST /api/log  ──►  console.log('[client-log] …')  ──► Vercel runtime logs
                  │
                  └── gated by readSession() — anon returns 401
```

Components:

- **`app/api/log/route.js`** (new, ~25 lines) — POST endpoint that emits one `console.log` line per accepted breadcrumb. Session-gated.
- **`components/ui/primitives.jsx`** (modified, ~20 lines added inside `SaveBanner`) — one `useEffect` that fires the dual breadcrumb on error transitions.

## New route: `app/api/log/route.js`

- `POST` only (no GET).
- Reject if `readSession(req)` returns null → 401, body `{ ok: false, error: 'unauthorized' }`.
- Reject if body isn't valid JSON → 400, body `{ ok: false, error: 'bad-json' }`.
- Reject if `kind` is missing or non-string → 400, body `{ ok: false, error: 'bad-kind' }`.
- Truncate inputs: `kind ≤ 64 chars`, `category ≤ 64 chars`, `message ≤ 500 chars`.
- Emit one log line:

  ```
  [client-log] kind=<kind> player=<session.name> category=<category|none> message=<JSON.stringify(truncated)>
  ```

- Return 204 (No Content) on success.
- Does NOT use Supabase. No env-var guard required.

Pseudocode:

```js
import { NextResponse } from 'next/server';
import { readSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const session = readSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 }); }

  const { kind, category, message } = body || {};
  if (typeof kind !== 'string' || !kind) {
    return NextResponse.json({ ok: false, error: 'bad-kind' }, { status: 400 });
  }

  const safeKind = kind.slice(0, 64);
  const safeCategory = typeof category === 'string' ? category.slice(0, 64) : null;
  const safeMessage = typeof message === 'string' ? message.slice(0, 500) : null;

  console.log(
    `[client-log] kind=${safeKind} player=${session.name} ` +
    `category=${safeCategory ?? 'none'} message=${JSON.stringify(safeMessage)}`,
  );

  return new NextResponse(null, { status: 204 });
}
```

## SaveBanner breadcrumb

Added inside the existing `SaveBanner` component in `components/ui/primitives.jsx`, near the `useEffect` that resets `dismissed`:

```js
const lastLoggedRef = useRef(null);
useEffect(() => {
  if (status !== 'error') return;
  const category = categorizeSaveError(error, sessionExpired);
  const tuple = `${category}|${error || ''}`;
  if (lastLoggedRef.current === tuple) return;
  lastLoggedRef.current = tuple;

  const message = String(error || '').slice(0, 500);
  // eslint-disable-next-line no-console
  console.warn('[save-banner]', { category, message });
  try {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'save-banner', category, message }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}, [status, error, sessionExpired]);
```

Notes:

- Effect dependencies are `[status, error, sessionExpired]`, NOT `[status, error, category]` — category is derived from the first two, so depending on it would force re-runs on every render with no semantic change. Re-deriving inside the effect is the right shape.
- `keepalive: true` lets the POST survive a tab close that immediately follows the banner mount.
- `.catch(() => {})` plus the outer `try/catch` guarantee that a failure to POST cannot escalate into another error banner.
- `lastLoggedRef` keys on `(category, error)` so a *new* error string under the same banner (without dismissal) still logs once.
- `useRef` is already imported at the top of `primitives.jsx`; no new import needed.

## Error handling

- `/api/log` errors are swallowed by the client. The banner is already showing — there's no useful UI consequence to surface.
- If `/api/log` itself is broken at deploy time, browser-side `console.warn` still fires. The endpoint failure also produces a Vercel 4xx/5xx HTTP log line, which is independently visible.
- The endpoint does not throw on missing optional fields (`category`, `message`). Only `kind` is required.

## Testing

Manual verification after deploy:

1. **Authenticated success path:**
   - Sign in as any player. Open browser devtools console.
   - Force a transient save failure: DevTools → Network → "Offline," then edit something to trigger a save.
   - Expect: red banner appears; `[save-banner]` line in browser console; `[client-log] kind=save-banner … category=network message=…` line in Vercel runtime logs within seconds.

2. **Anonymous gate:**
   - From terminal without cookie: `curl -X POST https://<prod>/api/log -H 'Content-Type: application/json' -d '{"kind":"test"}'`
   - Expect: 401 `{ ok: false, error: 'unauthorized' }`. No log line emitted.

3. **Malformed input:**
   - With auth cookie: `curl … -d 'not json'` → 400 `bad-json`.
   - With auth cookie: `curl … -d '{}'` → 400 `bad-kind`.

4. **Idempotence under sustained failure:**
   - Force a continuous error state (e.g., blank `SUPABASE_SERVICE_ROLE_KEY` on Preview, push a branch).
   - Let the banner sit visible for 30 seconds. The host component will re-render several times in that window.
   - Expect: exactly one `[client-log]` line in Vercel runtime logs across that window, not one per render.

## Out of scope (explicit YAGNI)

- Aggregating breadcrumbs (Vercel's built-in log filter is enough).
- Replaying old failures from log content.
- Hooking this into a third-party error tracker (Sentry / Logflare / etc).
- Forwarding the breadcrumb back to clients (no in-app debug view).
- Persisting breadcrumbs beyond Vercel's default log retention.

## Open implementation questions

None. Implementation can begin immediately.

## Decision summary

- **Approach A** (POST to `/api/log` → server-side `console.log` → Vercel runtime logs) chosen over B (Vercel Analytics custom events) and C (browser `console.warn` only).
- **Why:** lands the breadcrumb in the same Vercel runtime logs already used for `/api/league` and `/api/ingest-results` debugging — one dashboard, one mental model. Cost is ~45 lines of new code across two files; benefit is closing the diagnostic gap that made the 2026-05-17 incident take an hour instead of three minutes.
- **No structured `error.code` threading.** Current message-string classification works fine for users, and the breadcrumb captures the raw message verbatim, so any future server error that doesn't match a keyword will still be searchable in logs by the literal message text.
