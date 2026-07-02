-- Take push_subs off the anon PostgREST surface.
--
-- The baseline created push_subs with `create policy "anon all" ... for all
-- using (true) with check (true)`, granting the anon role (whose key ships in
-- the browser bundle) unrestricted SELECT/INSERT/UPDATE/DELETE on every row.
-- That let anyone: read every member's endpoint + p256dh/auth + player_id,
-- delete all subscriptions (a one-request notification wipe), or insert/update
-- a row under another player_id to receive that player's targeted "your turn"
-- pushes. The app has no Supabase-Auth identity (PIN auth), so the policy
-- couldn't be scoped to "own rows" — the client wrote push_subs directly with
-- the anon key.
--
-- Writes now go through the service-role, session-gated /api/push route, which
-- binds player_id to the session (app/api/push/route.js). Reads already happen
-- server-side in /api/notify (service role). So the client needs no anon
-- access at all: drop the policy and leave RLS enabled with none. With RLS on
-- and no policy, anon/authenticated get zero row access via PostgREST; the
-- service-role clients bypass RLS and are unaffected.

drop policy if exists "anon all" on public.push_subs;

-- Belt-and-suspenders: remove the default table-level privileges Supabase
-- grants the anon/authenticated roles, so push_subs isn't even reachable
-- before the (now absent) row policy is evaluated. RLS-with-no-policy already
-- denies row access, but revoking the grants removes it from the exposed API
-- surface entirely. service_role retains its own privileges.
revoke all on table public.push_subs from anon;
revoke all on table public.push_subs from authenticated;
