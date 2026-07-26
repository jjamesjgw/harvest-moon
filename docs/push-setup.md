# Push notifications setup

One-time setup to enable Web Push for Harvest Moon. Estimated time: ~15 minutes.

## 1. Generate VAPID keys

From the repo root:

```
npx web-push generate-vapid-keys
```

Copy the public + private values — you'll paste them into Vercel below.

## 2. Vercel environment variables

In the Vercel project → Settings → Environment Variables, add:

| Name                              | Value                                                            |
|-----------------------------------|------------------------------------------------------------------|
| `VAPID_PUBLIC_KEY`                | the public key from step 1                                        |
| `VAPID_PRIVATE_KEY`               | the private key from step 1                                       |
| `VAPID_SUBJECT`                   | `mailto:you@example.com`                                          |
| `NOTIFY_SECRET`                   | random 64-character string (e.g. `openssl rand -hex 32`)          |
| `SUPABASE_SERVICE_ROLE_KEY`       | Supabase dashboard → Project Settings → API → service_role key    |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`    | same value as `VAPID_PUBLIC_KEY`                                  |

Redeploy after saving — `NEXT_PUBLIC_*` values are baked in at build time.

## 3. Supabase setup

The trigger function reads its URL and secret from `public.app_config` at
runtime (migration `20260726030000_notify_config_table.sql`), so there is
nothing to hand-edit and nothing to paste from `push.sql` any more. The
function body is fully migration-managed.

1. Database → Extensions → enable **pg_net**.
2. Apply migrations: `supabase db push`.
3. **Immediately** run this in the SQL editor, substituting your real values.
   Between step 2 and step 3, push is disabled and every affected write logs
   `[notify] app_config missing notify_url/notify_secret` — so have this ready
   to paste.

   ```sql
   insert into public.app_config (key, value) values
     ('notify_url',    'https://YOUR-DEPLOYMENT.vercel.app/api/notify'),
     ('notify_secret', 'the same value as NOTIFY_SECRET in Vercel')
   on conflict (key) do update
     set value = excluded.value, updated_at = now();
   ```

`notify_secret` **must** equal the `NOTIFY_SECRET` env var in Vercel or
`/api/notify` rejects the call with 401. Nothing here is secret in the repo —
the values live only in Vercel env and this table.

## 4. Verify

- From the deployed app on a real device: Profile → "Turn on notifications". Accept the permission prompt.
- In Supabase SQL editor: `select count(*) from push_subs;` → returns at least 1.
- Unauthenticated curl is rejected:

```
curl -i -X POST https://YOUR-DEPLOYMENT.vercel.app/api/notify \
  -H 'content-type: application/json' -d '{}'
# → 401 unauthorized
```

- From a second device that's also subscribed, make a draft pick. The first device should receive a "X drafted Y" notification within a few seconds. Tap it → the app focuses on the draft screen.

## Notes

- **iOS**: Web Push only works on iOS 16.4+ AND only after the user has added the app to their Home Screen and opens it from there. The Profile screen detects this case and shows install instructions instead of a dead toggle.
- **Expired subscriptions** (404/410) are auto-deleted from `push_subs` on the next send attempt. No retry queue.
- **Trigger scope**: the database trigger only fires when `draftState.picks` or `weeklyResults` actually changes — profile edits and other writes don't generate HTTP traffic.
- **Rotating `NOTIFY_SECRET`**: update the Vercel env var, then re-run the `insert … on conflict do update` from step 3 with the new value. Both sides must match. No function edit, no hand-modified SQL.
- **Push silently stopped?** This is the failure mode the config table exists to make visible. Check, in order:
  ```sql
  select key, updated_at from public.app_config;   -- both rows present?
  select status_code, error_msg from net._http_response order by id desc limit 5;
  ```
  A missing row logs a warning on every affected write; a 401 in `net._http_response` means the table's `notify_secret` and Vercel's `NOTIFY_SECRET` have drifted apart.
