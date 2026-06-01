# Save Banner Breadcrumb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured breadcrumb (browser console + Vercel runtime logs) every time `SaveBanner` shows an error to a user, so the next "I got the red banner" report becomes a one-search-and-done in Vercel logs instead of an hour of correlating Postgres + Vercel logs.

**Architecture:** New `POST /api/log` route (session-gated, ~25 lines) emits one `console.log` line per accepted client breadcrumb. `SaveBanner` in `components/ui/primitives.jsx` gains one `useEffect` that fires `console.warn` + a fire-and-forget POST to `/api/log` exactly once per `(category, error)` tuple while `status === 'error'`. Spec: `docs/superpowers/specs/2026-05-17-save-banner-breadcrumb-design.md`.

**Tech Stack:** Next.js App Router (Node runtime, `force-dynamic`), React (client component), existing custom session helper at `lib/session.js`. No new dependencies.

---

## Pre-flight

Before starting:

- [ ] **Branch from `main` after the spec PR (#29) has merged.**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/save-banner-breadcrumb
```

Expected: `git status` reports a clean working tree on a new branch named `feat/save-banner-breadcrumb`.

---

## Task 1: Create the `/api/log` route

**Files:**

- Create: `app/api/log/route.js`

- [ ] **Step 1: Create `app/api/log/route.js` with the full handler**

Write the new file with this exact content:

```js
import { NextResponse } from 'next/server';
import { readSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Client-side breadcrumb endpoint. Emits one structured `console.log`
// line per accepted event so failures the user sees (and only the user
// sees) land in Vercel runtime logs next to server-side errors.
//
// Gated by the existing hm_session cookie — anonymous browsers can't
// post. For a 6-user private league that is the entire access-control
// story; no separate rate limit or shared secret.
//
// See docs/superpowers/specs/2026-05-17-save-banner-breadcrumb-design.md
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

- [ ] **Step 2: Verify the build compiles**

Run:

```bash
npm run build
```

Expected: build completes with `✓ Compiled successfully`. There may be pre-existing prerender warnings about missing Supabase env vars during static page generation — those are unrelated to this route (the route is `force-dynamic`).

If the build fails on something inside `app/api/log/route.js`, stop and fix it before proceeding. Common causes: typo in the import path, missing `'use server'` directive (not needed for route handlers — don't add it), copy-paste error.

- [ ] **Step 3: Commit**

```bash
git add app/api/log/route.js
git commit -m "feat: add /api/log endpoint for client breadcrumbs"
```

Expected: commit succeeds. `git log -1 --stat` shows one new file (`app/api/log/route.js`).

---

## Task 2: Wire up the SaveBanner breadcrumb

**Files:**

- Modify: `components/ui/primitives.jsx` — the existing `SaveBanner` component (search for `export function SaveBanner`; it is near the bottom of the file, after `SAVE_BANNER_COPY`).

- [ ] **Step 1: Confirm `useRef` is already imported**

Open `components/ui/primitives.jsx`. Verify the first import line is exactly:

```js
import React, { useState, useEffect, useRef } from 'react';
```

If `useRef` is missing, add it to the destructured import. (At the time of writing, it is already imported and used by `PullToRefresh`.)

- [ ] **Step 2: Add the breadcrumb effect inside `SaveBanner`**

Locate the existing body of `SaveBanner`. The first few lines look like this:

```js
export function SaveBanner({ status, error, sessionExpired, onRetry }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { if (status !== 'error') setDismissed(false); }, [status]);
  if (status !== 'error' || dismissed) return null;
  const category = categorizeSaveError(error, sessionExpired);
  const copy = SAVE_BANNER_COPY[category];
  // ... render ...
```

Insert the new `useRef` and `useEffect` directly AFTER the existing `useEffect` and BEFORE the `if (status !== 'error' || dismissed) return null;` early-return. The block to insert is:

```js
  // Emit a structured breadcrumb when the banner shows an error. Fires
  // once per (category, error) tuple so re-renders under a sustained
  // failure don't spam logs. Failures of the breadcrumb itself are
  // swallowed — a broken /api/log must never escalate into another
  // banner. See docs/superpowers/specs/2026-05-17-save-banner-breadcrumb-design.md
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

Note the dependency array: `[status, error, sessionExpired]`, NOT `[status, error, category]`. Category is derived from the first two, so depending on it would force the effect to re-run on every render. Re-deriving inside the effect is correct.

- [ ] **Step 3: Verify the build compiles**

Run:

```bash
npm run build
```

Expected: `✓ Compiled successfully`. The new code uses only existing imports (`useEffect`, `useRef`, `categorizeSaveError`).

- [ ] **Step 4: Commit**

```bash
git add components/ui/primitives.jsx
git commit -m "feat: emit breadcrumb when SaveBanner shows error"
```

Expected: commit succeeds. `git log -1 --stat` shows one modified file with roughly +22/-0 lines.

---

## Task 3: Open PR and verify on Vercel preview

- [ ] **Step 1: Push the branch and open the PR**

```bash
git push -u origin feat/save-banner-breadcrumb
gh pr create --title "feat: add client breadcrumb when SaveBanner shows error" --body "$(cat <<'EOF'
## What changed

Implements `docs/superpowers/specs/2026-05-17-save-banner-breadcrumb-design.md`:

- New `app/api/log/route.js` — session-gated POST that emits one `[client-log]` line per accepted event into Vercel runtime logs.
- One `useEffect` added inside `SaveBanner` (`components/ui/primitives.jsx`) that fires `console.warn` + a fire-and-forget POST to `/api/log` once per `(category, error)` tuple.

## Why

The 2026-05-17 incident hit the `unknown` SaveBanner category because the route handler bubbled up an RLS error message that didn't match any keyword in `categorizeSaveError`. The user-facing copy was correct, but there was no log signal naming the bucket or carrying the raw error. The next "I got the red banner" report should be one Vercel log search away.

## How to verify

See the verification steps in `docs/superpowers/plans/2026-05-18-save-banner-breadcrumb.md` Task 3.

## Rollback

Revert this PR. Additive only; no DB state, no client API contract change.
EOF
)"
```

Expected: PR opens, link printed to stdout. Vercel begins building a preview.

- [ ] **Step 2: Wait for the preview build to finish**

Watch `gh pr checks <pr-number> --watch --interval 10` or refresh the PR page until the Vercel preview deployment URL appears in the PR comment. Note both the PR number and the preview URL (format: `harvest-moon-<hash>-jjamesjgws-projects.vercel.app`).

- [ ] **Step 3: Anonymous-gate test**

Run (substitute your preview URL):

```bash
curl -i -X POST https://<preview>/api/log \
  -H 'Content-Type: application/json' \
  -d '{"kind":"manual-test"}'
```

Expected: `HTTP/1.1 401 Unauthorized`, body `{"ok":false,"error":"unauthorized"}`. No `[client-log]` line emitted in Vercel runtime logs for this request.

- [ ] **Step 4: Sign in to the preview to get a session cookie**

Open `https://<preview>/` in a browser, sign in as any player. In devtools → Application → Cookies, copy the full value of `hm_session` (it will look like `<base64>.<base64>`).

- [ ] **Step 5: Malformed-body tests**

With the cookie from step 4:

```bash
curl -i -X POST https://<preview>/api/log \
  -H 'Content-Type: application/json' \
  --cookie 'hm_session=<paste-value-here>' \
  -d 'not json'
```

Expected: `HTTP/1.1 400 Bad Request`, body `{"ok":false,"error":"bad-json"}`.

```bash
curl -i -X POST https://<preview>/api/log \
  -H 'Content-Type: application/json' \
  --cookie 'hm_session=<paste-value-here>' \
  -d '{}'
```

Expected: `HTTP/1.1 400 Bad Request`, body `{"ok":false,"error":"bad-kind"}`.

- [ ] **Step 6: Success path test**

```bash
curl -i -X POST https://<preview>/api/log \
  -H 'Content-Type: application/json' \
  --cookie 'hm_session=<paste-value-here>' \
  -d '{"kind":"manual-test","category":"unit-test","message":"hello world"}'
```

Expected: `HTTP/1.1 204 No Content`, empty body. In Vercel runtime logs for the preview deployment, expect this line within a few seconds:

```
[client-log] kind=manual-test player=<your-player-name> category=unit-test message="hello world"
```

If the line doesn't appear: check the deployment ID matches the preview, and that you're looking at runtime logs (not build logs).

- [ ] **Step 7: Browser breadcrumb — offline failure (network category)**

On the preview deploy, signed in:

1. Open devtools → Network → set Throttling to **Offline**.
2. Edit a Profile field (e.g., favorite-driver number) to trigger a save.
3. Wait ~1 second (800ms debounce + flush).

Expected:
- Red `SaveBanner` appears with "You're offline." copy.
- Browser console (devtools → Console) shows a warning line: `[save-banner] {category: 'network', message: 'Failed to fetch'}` (the exact message string may vary by browser).
- `[client-log]` does NOT appear in Vercel logs for this case — the same offline condition that broke the save also blocks the POST to `/api/log`. The local `console.warn` is the only signal, which is by design.

4. Set Throttling back to **Online**. Wait for the save to succeed (banner clears).

- [ ] **Step 8: Browser breadcrumb — server failure (server category)**

This test confirms `[client-log]` reaches Vercel for a non-network failure. Two options:

**Option A (preferred, faster):** Temporarily blank `SUPABASE_SERVICE_ROLE_KEY` in Vercel for the Preview scope, redeploy the branch.

With the broken preview, signed in, network online:

1. Edit a Profile field to trigger a save.
2. Wait ~1s.

Expected:
- Red `SaveBanner` appears with `[league/route]` env-guard message OR a 502-derived message (depending on whether the build's module-init guard from #27 fires first).
- Browser console: `[save-banner] {category: 'server', message: '...'}` (or `unknown` if message doesn't match — still acceptable; the breadcrumb captures the raw message either way).
- Vercel runtime logs for the preview show: `[client-log] kind=save-banner player=<your-name> category=server message="..."` within seconds.

3. Restore `SUPABASE_SERVICE_ROLE_KEY` in Vercel Preview scope. Redeploy.

**Option B (no env tampering):** Skip Step 8 — the network-category path in Step 7 plus the manual curl in Step 6 are together sufficient evidence that the wiring works end-to-end.

- [ ] **Step 9: Idempotence test**

During Step 8 Option A (with the banner sustained for 30+ seconds), watch Vercel runtime logs.

Expected: **exactly one** `[client-log]` line per distinct error message during the sustained banner. Multiple lines indicate the `lastLoggedRef` guard isn't keying correctly — if you see this, abort and re-check the dependency array in the effect.

- [ ] **Step 10: Merge**

Once CI is green and all verification steps pass:

```bash
gh pr merge <pr-number> --squash --delete-branch
```

Expected: PR merges, branch deleted, Vercel deploys to production. Confirm by checking `gh run watch` or the Vercel deployment list — the new production deployment should be `READY` within ~90 seconds.

- [ ] **Step 11: Post-merge smoke test on production**

Reopen the production app, sign in, briefly toggle Network to Offline + trigger a save (same as Step 7 but against production). Confirm `[save-banner]` lands in the browser console. (The `[client-log]` line won't appear in Vercel logs because we're offline; that's expected.)

If this works, the feature is fully shipped. If not, revert immediately:

```bash
gh pr revert <pr-number>
```

Then iterate on a follow-up branch.

---

## Done criteria

All three tasks complete:

- `app/api/log/route.js` exists on `main` and serves 401/400/204 correctly per the curl tests.
- `SaveBanner` emits `console.warn` and POSTs to `/api/log` exactly once per `(category, error)` tuple per error session.
- Vercel runtime logs contain `[client-log]` lines under failure simulation.
- Production smoke test (Step 11) passes.
