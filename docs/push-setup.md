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

In the Supabase dashboard:

1. Database → Extensions → enable **pg_net**.
2. SQL editor → run `supabase/push.sql` (already in this repo).
3. SQL editor → run, replacing the two values:

```sql
alter database postgres set app.notify_url    = 'https://YOUR-DEPLOYMENT.vercel.app/api/notify';
alter database postgres set app.notify_secret = 'THE-SAME-NOTIFY-SECRET-FROM-STEP-2';
```

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
