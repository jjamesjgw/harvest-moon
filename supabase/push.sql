-- Harvest Moon: push-notification additions to the existing schema.
-- Run this once in Supabase SQL editor AFTER schema.sql.
--
-- BEFORE RUNNING: replace REPLACE_WITH_NOTIFY_URL and REPLACE_WITH_NOTIFY_SECRET
-- inside notify_league_changes() below with your real values, then paste the
-- whole modified file into the SQL editor. Supabase does not permit
-- `alter database ... set app.*`, so the values must be inlined into the
-- function body instead of read from current_setting().
--
-- DO NOT COMMIT THE FILLED-IN VERSION — NOTIFY_SECRET is what gates
-- /api/notify. Keep real values in Vercel env vars and in the live
-- Supabase function only.
--
-- Prerequisite: enable the pg_net extension in Database → Extensions.

-- 1. Subscriptions table (same trust model as `leagues`: world-writable).
create table if not exists public.push_subs (
  player_id  text        not null,
  endpoint   text        primary key,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz default now()
);

alter table public.push_subs enable row level security;

drop policy if exists "anon all" on public.push_subs;
create policy "anon all" on public.push_subs for all using (true) with check (true);

-- 2. Trigger function: forward old + new league state to the Next.js notify
--    endpoint. Event detection happens server-side in JavaScript, where the
--    existing draft helpers in lib/utils.js can be reused.
create or replace function public.notify_league_changes()
returns trigger language plpgsql security definer as $$
declare
  url    text := 'REPLACE_WITH_NOTIFY_URL';     -- e.g. https://harvest-moon.vercel.app/api/notify
  secret text := 'REPLACE_WITH_NOTIFY_SECRET';  -- the same value as Vercel env NOTIFY_SECRET
begin
  perform net.http_post(
    url,
    jsonb_build_object('oldState', old.state, 'newState', new.state),
    '{}'::jsonb,
    jsonb_build_object('x-notify-secret', secret, 'content-type', 'application/json')
  );

  return new;
end $$;

-- 3. Trigger fires only when notify-relevant subtrees actually change, so
--    profile edits and other unrelated writes don't trigger HTTP calls.
drop trigger if exists leagues_notify on public.leagues;
create trigger leagues_notify
  after update on public.leagues
  for each row
  when (
    new.state->'draftState'->'picks' is distinct from old.state->'draftState'->'picks'
    or new.state->'weeklyResults'     is distinct from old.state->'weeklyResults'
  )
  execute function public.notify_league_changes();
