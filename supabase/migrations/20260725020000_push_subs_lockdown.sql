-- Close the last unauthenticated write surface: public.push_subs.
--
-- The baseline shipped `create policy "anon all" on public.push_subs for all
-- using (true) with check (true)`. RLS was enabled but wide open, and the anon
-- key ships inside the browser bundle — so anyone on the public internet could,
-- via PostgREST:
--   * SELECT every row and read all subscription secrets
--     (player_id, endpoint, p256dh, auth);
--   * DELETE any or all rows, silently killing league notifications until each
--     player happened to re-enable them;
--   * INSERT a row carrying another player's player_id and an attacker-owned
--     endpoint, so /api/notify's targeted "you're on the clock" pushes would be
--     delivered to the attacker (loadSubs filters by player_id).
--
-- Sending a push still requires the VAPID private key, so read alone was low
-- impact — but the delete/insert surface was genuine unauthenticated write
-- access. This is the same class already closed for public.leagues (anon
-- SELECT only; all writes behind a service-role route handler) and for
-- leagues_history in 20260603130000.
--
-- After this migration push_subs has NO policies at all, which under RLS means
-- anon and authenticated get nothing. Access is exclusively:
--   * POST/DELETE /api/push   — session-cookie gated, service role, takes
--                               player_id from the signed cookie
--   * /api/notify             — service role (already; unaffected)
-- service_role bypasses RLS, so both keep working.
--
-- ORDER OF OPERATIONS — apply this AFTER the matching app deploy is live.
-- The new /api/push route works whether or not this migration has run (service
-- role bypasses RLS either way), but the OLD client wrote push_subs directly
-- with the anon key. Applying this before that code is deployed would make
-- "turn on notifications" fail for the gap in between. Deploy first, then
-- `supabase db push`. Nothing here is destructive to data.

drop policy if exists "anon all" on public.push_subs;

-- Belt-and-braces: RLS was already enabled in the baseline, but a table with
-- no policies and RLS somehow disabled would be fully open, which is exactly
-- the state we're removing. Re-asserting is idempotent and cheap.
alter table public.push_subs enable row level security;

-- Deliberately no replacement policy. Every legitimate reader and writer uses
-- the service role. If a future feature needs direct client reads, add a
-- narrow policy then rather than restoring a blanket one.
