# Harvest Moon

Private 6-person NASCAR fantasy league app. Realtime sync — when one player picks a driver, every other phone in the league sees it within a second.

**Stack:** Next.js 16 (App Router, JS) · React 19 · Supabase (Postgres + Realtime + PIN auth) · Vercel (host + cron + web push).

---

## Project layout

```
app/
  api/
    auth/                 PIN login + logout
    league/               main WRITE endpoint (service-role, CAS). Reads go
                          direct from the client via the anon SELECT policy
    league/reset/         sanctioned season wipe (admin-only, snapshot-first)
    ingest-results/       cron-driven Wikipedia results ingest
    admin/snapshot/       on-demand DB snapshot
    notify/               web-push fan-out
components/
  HarvestMoon.jsx         root shell — routing, session, realtime
  screens/                one file per app screen
  ui/primitives.jsx       shared TopBar / MenuRow / etc.
lib/
  constants.js            tokens, font stacks, CANONICAL_PLAYERS, ADMIN_ID
  utils.js                standings, snake order, schedule
  scoring.js              weekly point rollup
  supabase.js             anon browser client (service-role clients are
                          constructed per-route, not here)
  session.js              hm_session cookie sign/verify (server-only)
  raceFeed.js             Wikipedia fetch + results parsing
  db/snapshot.js          withSnapshot() — fail-closed pre-flight snapshots
supabase/
  migrations/             numbered SQL — the only path to prod schema changes
  config.toml             supabase CLI config
  schema.sql, push.sql    legacy/template only — NOT setup scripts (see their headers)
vercel.json               cron schedules
```

---

## Authentication

Every league member has a tile on the login screen and a 4-digit PIN, bcrypt-hashed in `public.pins`. The PIN is verified server-side via the `verify_pin()` SECURITY DEFINER function; on success an HttpOnly `hm_session` cookie is set. Justin's profile (`p_justin`) is the commissioner — `me.isAdmin` is true for him throughout the app. He can toggle "View as User" from his Profile to hide commissioner controls when browsing.

---

## Environment variables

Set these in Vercel for all environments (Production, Preview, Development):

| Name | Source | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | client + every server route |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | anon supabase-js client |
| `SUPABASE_SERVICE_ROLE_KEY` | same — **never expose to the client** | `/api/league`, `/api/ingest-results`, `/api/admin/snapshot`. Must be the full ~210-char JWT; module-init guards throw at cold-start if it's missing or implausibly short |
| `SESSION_SECRET` | random, **min 32 chars** | signs the `hm_session` cookie. `lib/session.js` throws at cold start if it's missing or shorter, so **every login 500s without it**. Rotating it invalidates every live session (all 6 players re-enter their PIN) |
| `NEXT_PUBLIC_LEAGUE_ID` | choose | row id in `public.leagues` (default: `harvest-moon`) |
| `CRON_SECRET` | random | Vercel cron auth header for `/api/ingest-results` |
| `INGEST_SECRET` | random | manual ingest trigger via `x-ingest-secret` |
| `NOTIFY_SECRET` | random | must match the secret in `notify_league_changes()` (inlined in baseline migration) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` | web push — see `docs/push-setup.md` (which also covers `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_SUBJECT`) |

`.env.example` is the authoritative list — if it and this table ever disagree, trust `.env.example`.

---

## Making changes

1. Branch — `kind/short-slug` where kind ∈ `feat | fix | chore | audit | refactor | db | docs`.
2. PR — one concern per PR. Vercel auto-deploys a preview.
3. Merge to `main` — production deploys in ~60s.

Local dev:

```bash
npm install
npm run dev     # localhost:3000, hot-reload
```

---

## Database

The live schema is the sum of every file in `supabase/migrations/`. The squashed baseline (`20260512040000_baseline.sql`) captures the full schema state as of 2026-05-12; everything after is incremental.

Key surfaces:
- `public.leagues` — single row of the league state JSONB
- `public.leagues_history` — append-only audit log, written by the pre-update trigger on every UPDATE
- `public.leagues_snapshots` — point-in-time recovery, daily cron + manual via `/api/admin/snapshot`
- `public.pins` — RLS-locked, only readable via `verify_pin()`
- `public.push_subs` — web-push subscriptions

**Database changes go through `supabase/migrations/*.sql` only — never edit prod via the dashboard.** Apply via the Supabase CLI (`supabase db push`) or paste into the SQL editor for one-offs.

The one standing exception is `notify_league_changes()`, which carries the notify URL and secret inline (Supabase can't read env vars from SQL). The committed migration ships `REPLACE_WITH_*` placeholders, so **on a fresh project push notifications are silently dead until that function body is re-applied with real values** — the trigger fires, `pg_net` discards the result, and nothing surfaces an error. The procedure is `docs/push-setup.md` section 3. (An older comment inside the baseline migration points at `docs/staging-supabase-setup.md`, which no longer exists — use `docs/push-setup.md`.)

### Recovering from a bad write

```sql
-- Find recent revisions
select history_id, changed_at, client_tag
from public.leagues_history
where league_id = 'harvest-moon'
order by history_id desc limit 20;

-- Restore (escape-hatch GUC bypasses the fresh-shape guard)
begin;
set local harvest_moon.allow_wipe = 'true';
update public.leagues
set state = (select state from public.leagues_history where history_id = <id>)
where id = 'harvest-moon';
commit;
```

---

## Cron

`vercel.json` schedules `/api/ingest-results` to auto-fill Cup driver points from the Wikipedia race article for the most recent finished race. See `vercel.json` for the authoritative schedule; it currently runs Sunday at 06:00 / 14:00 / 23:00 UTC and Monday at 01:00 / 03:00 / 05:00 UTC. The Sunday-morning runs exist so **Saturday-night races** (e.g. Richmond, Daytona II, Bristol Night Race) — which finish late Saturday ET — are picked up Sunday morning instead of waiting until Sunday night. Runs are idempotent: a week that already has Cup data is skipped, so extra runs are safe. **Week advancement is still manual** — the commissioner taps "Save & Advance" in Enter Results.

To retry a missed ingest by hand, POST to `/api/ingest-results` with the `x-ingest-secret` header (see `INGEST_SECRET` in `.env.example`).

---

## Onboarding a new league member

1. Add their entry in `lib/constants.js` (CANONICAL_PLAYERS) — id, name, color, initial.
2. Hash + insert their PIN into `public.pins`:
   ```sql
   insert into public.pins (name, pin_hash)
   values ('newname', extensions.crypt('1234', extensions.gen_salt('bf', 8)));
   ```
3. Deploy. They'll see their tile on the login screen.

---

## Custom domain

Vercel → project → Settings → Domains → Add. Vercel walks through the DNS records.

---

## When something breaks

- **Blank screen on the live site** — Vercel → project → Deployments → latest → View Function Logs.
- **"Loading league…" never resolves** — Supabase env vars are missing or wrong. The module-init guards in `/api/league` will surface the actual cause in the deployment logs at cold-start.
- **Realtime not updating** — confirm the `alter publication supabase_realtime add table public.leagues` line ran (it's in the baseline migration).
- **Save banner stuck red** — usually a stale `SUPABASE_SERVICE_ROLE_KEY` after a rotation. The fail-loud guards (PR #27, #28) make this visible in logs now.
