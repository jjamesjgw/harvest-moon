-- Harvest Moon: push-notification additions to the existing schema.
-- Run this once in Supabase SQL editor AFTER schema.sql.
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
  url    text := current_setting('app.notify_url',    true);
  secret text := current_setting('app.notify_secret', true);
begin
  if url is null or secret is null then return new; end if;

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

-- 4. One-time configuration. Edit these two values before running.
--    Both must match the corresponding Vercel env vars on the Next.js side.
-- alter database postgres set app.notify_url    = 'https://YOUR-DEPLOYMENT.vercel.app/api/notify';
-- alter database postgres set app.notify_secret = 'CHANGE-ME-64-RANDOM-CHARS';
