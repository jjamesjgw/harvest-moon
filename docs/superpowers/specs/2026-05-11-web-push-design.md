# Web Push Notifications — Design

**Date:** 2026-05-11
**Status:** Approved for implementation planning

## Goal

Deliver real-time push notifications to all six league members for four event types:

1. **Your turn to draft** — sent to the single player now on the clock.
2. **Someone made a pick** — sent to everyone except the picker.
3. **Weekly results posted** — sent to everyone when a week's results become final.
4. **Standings/points changed** — generic fallback for any other state change; **off by default**, gated by a setting.

Notifications must originate from the backend so that delivery does not depend on whether any client tab is alive when the event happens.

## Non-goals

- Per-event mute / quiet hours / categories beyond the four above.
- Notification history, read receipts, or in-app inbox.
- Retry queues, dead-letter tables, or guaranteed delivery — a missed push is acceptable for a 6-person private league.
- Auth beyond what already exists (player picker in `localStorage`). No accounts, no email/SMS fallback.

## Architecture

```
┌──────────────┐  optimistic   ┌─────────────────────┐
│ Client (any) │ ─── update ──►│ Supabase leagues    │
└──────────────┘               │ (jsonb state blob)  │
                               └────────┬────────────┘
                                AFTER UPDATE trigger
                                        │ diffs OLD/NEW
                                        ▼
                                  pg_net.http_post
                                        │ x-notify-secret
                                        ▼
                           ┌────────────────────────────┐
                           │ /api/notify (Next.js route)│
                           │  web-push.sendNotification │
                           └────────┬───────────────────┘
                                    │ per subscription
                                    ▼
                          ┌─────────────────────┐
                          │ Service worker on   │
                          │ each subscribed     │
                          │ device → toast      │
                          └─────────────────────┘
```

Components:

- **`public/sw.js`** — service worker. Handles `push` and `notificationclick` events.
- **`lib/push.js`** — client helper. `enablePush(playerId)` / `disablePush(playerId)`. Wraps permission prompt, SW registration, `pushManager.subscribe`, and upsert into `push_subs`.
- **`push_subs` table** (Supabase) — one row per device subscription.
- **`app/api/notify/route.js`** — Next.js POST endpoint that loads subscriptions and calls `web-push.sendNotification`.
- **Postgres trigger on `leagues`** — diffs state, fires `pg_net.http_post` to `/api/notify` for each detected event.
- **Notifications settings UI** in `ProfileScreen.jsx` — toggle + iOS install hint.

## Data flow (example: a player drafts someone)

1. Client A calls `setState` → `leagues` row UPDATE in Supabase.
2. `AFTER UPDATE` trigger fires. It detects:
   - `state.draft.onClockPlayerId` changed → enqueue `{event:"your_turn", player_id: NEW_ID}`.
   - `state.draft.picks` grew by one → enqueue `{event:"pick", exclude_player_id: PICKER_ID, payload:{picker, drafted}}`.
3. For each event, trigger calls `pg_net.http_post(app.notify_url, body, headers={x-notify-secret: app.notify_secret})`.
4. `/api/notify` validates the secret, looks up matching subscriptions in `push_subs`, calls `web-push.sendNotification` per row.
5. Service workers receive `push`, call `showNotification(title, {body, data:{url}})`. Tap focuses/opens the app to `data.url`.

Independence: Client A may close its tab immediately after the optimistic update — the trigger and `/api/notify` run regardless.

## Database changes

```sql
-- subscriptions
create table public.push_subs (
  player_id  text        not null,
  endpoint   text        primary key,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz default now()
);

alter table public.push_subs enable row level security;
create policy "anon all" on public.push_subs for all using (true) with check (true);
-- Same trust model as the existing leagues table; tighten later alongside real auth.

-- trigger
create or replace function public.notify_league_changes()
returns trigger language plpgsql security definer as $$
declare
  url    text := current_setting('app.notify_url',    true);
  secret text := current_setting('app.notify_secret', true);

  old_on_clock text := old.state #>> '{draft,onClockPlayerId}';
  new_on_clock text := new.state #>> '{draft,onClockPlayerId}';

  old_pick_count int := coalesce(jsonb_array_length(old.state #> '{draft,picks}'), 0);
  new_pick_count int := coalesce(jsonb_array_length(new.state #> '{draft,picks}'), 0);

  old_results_final bool := coalesce((old.state #>> '{results,currentWeekFinal}')::bool, false);
  new_results_final bool := coalesce((new.state #>> '{results,currentWeekFinal}')::bool, false);

  last_pick jsonb;
  body      jsonb;
begin
  if url is null or secret is null then return new; end if;

  -- 1. on-clock changed
  if new_on_clock is distinct from old_on_clock and new_on_clock is not null then
    body := jsonb_build_object(
      'event',     'your_turn',
      'player_id', new_on_clock,
      'title',     'Harvest Moon',
      'body',      'You''re on the clock',
      'url',       '/?screen=draft'
    );
    perform net.http_post(url, body, '{}'::jsonb,
      jsonb_build_object('x-notify-secret', secret, 'content-type', 'application/json'));
  end if;

  -- 2. new pick appeared
  if new_pick_count > old_pick_count then
    last_pick := new.state #> array['draft','picks', (new_pick_count - 1)::text];
    body := jsonb_build_object(
      'event',             'pick',
      'exclude_player_id', last_pick ->> 'byPlayerId',
      'title',             'Harvest Moon',
      'body',              (last_pick ->> 'byPlayerName') || ' drafted ' || (last_pick ->> 'driverName'),
      'url',               '/?screen=draft'
    );
    perform net.http_post(url, body, '{}'::jsonb,
      jsonb_build_object('x-notify-secret', secret, 'content-type', 'application/json'));
  end if;

  -- 3. weekly results just got finalized
  if new_results_final and not old_results_final then
    body := jsonb_build_object(
      'event', 'results',
      'title', 'Harvest Moon',
      'body',  'Week ' || coalesce(new.state #>> '{currentWeek}', '?') || ' results posted',
      'url',   '/?screen=standings'
    );
    perform net.http_post(url, body, '{}'::jsonb,
      jsonb_build_object('x-notify-secret', secret, 'content-type', 'application/json'));
  end if;

  return new;
end $$;

create trigger leagues_notify after update on public.leagues
  for each row execute function public.notify_league_changes();
```

**JSON paths** (`draft.onClockPlayerId`, `draft.picks[].byPlayerId/byPlayerName/driverName`, `results.currentWeekFinal`, `currentWeek`) are placeholders — the implementation step must verify them against the real state shape in `lib/useLeague.js` and `components/HarvestMoon.jsx` and adjust before shipping. If a real shape doesn't have a clean field, the implementation may add it as part of this work.

The generic "standings changed" event is **not** wired in this trigger initially; deferred until we confirm we want the noise.

**Required extension:** `pg_net` must be enabled in the Supabase project (Database → Extensions).

**Required DB settings (one-time):**
```sql
alter database postgres set app.notify_url    = 'https://<deployment>.vercel.app/api/notify';
alter database postgres set app.notify_secret = '<random-64-char>';
```

## API route: `app/api/notify/route.js`

- `POST` only. Reject any other method with 405.
- Reject if `x-notify-secret` header doesn't match `process.env.NOTIFY_SECRET` (constant-time compare). 401 otherwise.
- Body shape:
  ```ts
  {
    event: 'your_turn' | 'pick' | 'results',
    player_id?: string,          // when set, target only this player
    exclude_player_id?: string,  // when set, target everyone except this player
    title: string,
    body: string,
    url: string
  }
  ```
- Subscription query:
  - `player_id` set → `select * from push_subs where player_id = $1`
  - `exclude_player_id` set → `select * from push_subs where player_id <> $1`
  - neither → `select * from push_subs`
- For each subscription, call `webpush.sendNotification({endpoint, keys:{p256dh, auth}}, JSON.stringify({title, body, url}))`.
- On rejection with `statusCode` 404 or 410, delete the row from `push_subs`.
- All other errors: log and continue. Return `{sent, removed, failed}` counts.
- Uses the Supabase service-role key from `SUPABASE_SERVICE_ROLE_KEY` to read/delete `push_subs` (server-only).

## Client helper: `lib/push.js`

```js
export async function enablePush(playerId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return { ok: false, reason: 'unsupported' };
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return { ok: false, reason: 'denied' };
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  });

  const { endpoint, keys } = sub.toJSON();
  await supabase.from('push_subs').upsert({
    player_id: playerId,
    endpoint,
    p256dh: keys.p256dh,
    auth:   keys.auth,
  }, { onConflict: 'endpoint' });

  return { ok: true };
}

export async function disablePush(playerId) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_subs').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
}
```

## Service worker: `public/sw.js`

```js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Harvest Moon', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.includes(self.location.origin));
      if (open) { open.navigate(url); return open.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
```

## Settings UI

In `ProfileScreen.jsx`, add a single "Push notifications" section:

- **iOS Safari (not standalone):** show "To get notifications on iPhone, tap Share and choose **Add to Home Screen**, then open the app from your home screen." Hide the toggle. Detection: `/iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone`.
- **Otherwise:** show a toggle. On enable, call `enablePush(me.id)` and surface any `reason` returned (`unsupported`, `denied`) inline. On disable, call `disablePush(me.id)`.
- Toggle state reflects whether a current `pushManager` subscription exists for this device.

## Environment variables

| Name                              | Where                | Value                                                                     |
|-----------------------------------|----------------------|---------------------------------------------------------------------------|
| `VAPID_PUBLIC_KEY`                | Vercel (server)      | from `npx web-push generate-vapid-keys`                                   |
| `VAPID_PRIVATE_KEY`               | Vercel (server)      | same command                                                              |
| `VAPID_SUBJECT`                   | Vercel (server)      | `mailto:justinjamescreative@gmail.com`                                    |
| `NOTIFY_SECRET`                   | Vercel (server) + DB | random 64 chars, must match `app.notify_secret`                           |
| `SUPABASE_SERVICE_ROLE_KEY`       | Vercel (server)      | already in Supabase dashboard; needed by `/api/notify` to read `push_subs`|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`    | Vercel (public)      | same value as `VAPID_PUBLIC_KEY`, exposed to client                       |

## Error handling

- **Expired/gone subscription** (404, 410 from push service): delete the row in `push_subs`. No retry.
- **Other send errors**: log and continue with the rest of the batch. Caller sees `{sent, removed, failed}` counts.
- **Trigger errors**: `pg_net.http_post` is fire-and-forget; failures are silent. Acceptable.
- **No retry queue, no dead-letter table.**
- **Permission denied** in browser: UI surfaces this inline; no further action.

## Testing

Local:
- Run `next dev --experimental-https` (Web Push requires HTTPS, even on localhost in some browsers).
- Manually edit `leagues.state` in Supabase SQL editor to simulate each event branch; verify the service worker shows a notification on a second device.
- Verify the `x-notify-secret` gate rejects unauthenticated POSTs (`curl` without header → 401).

Pre-merge sanity:
- Subscribe a real device from a Vercel preview deployment.
- Trigger each of the three events from the live app; confirm delivery and tap-to-open behavior.

## Out of scope (explicit YAGNI)

- Generic "state changed" notifications (deferred behind a future setting).
- Retry/dead-letter infrastructure.
- Multi-language notification copy.
- In-app notification center / history.
- Per-event mute toggles.

## Open implementation questions

These are deferred to the implementation plan rather than this design:

1. Verify exact `state` JSON paths (`draft.onClockPlayerId`, `draft.picks[i].byPlayerName/driverName`, `results.currentWeekFinal`, `currentWeek`) match the real shape in `useLeague.js`. Adjust trigger SQL if names differ.
2. Confirm `pg_net` is available on this Supabase plan (free tier supports it; verify).
3. Where the "Notifications" toggle lives if `ProfileScreen.jsx` doesn't exist with the expected shape — fall back to `MoreScreen.jsx`.
4. Whether to also notify the picker themselves with a confirmation toast (currently excluded).

## Decision summary

- **Approach A** (self-hosted web push, server-triggered) chosen over B (OneSignal) and C (client-triggered).
- **Why:** zero vendor / zero monthly cost, smallest deployment surface, robust to clients dying mid-update, trivial scale (6 users).
- **iOS install-required** UX accepted as a hard constraint of the Web Push protocol; surfaced in the settings UI.
