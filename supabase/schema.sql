-- Harvest Moon: one-time Supabase setup
-- Paste this entire file into Supabase → SQL Editor → New query → Run

-- 1. The one table we need: a single row per league, state stored as JSON
create table if not exists public.leagues (
  id          text primary key,
  state       jsonb not null,
  write_id    bigint default 0,
  updated_at  timestamptz default now()
);

-- 2. Enable row-level security. Anon can SELECT (needed for the client's
--    initial pull and the realtime subscription) but cannot write — every
--    mutating call has to go through /api/league, which uses the service-
--    role key. Login is gated by /api/auth/login → hm_session cookie.
alter table public.leagues enable row level security;

drop policy if exists "anon read"   on public.leagues;
drop policy if exists "anon insert" on public.leagues;
drop policy if exists "anon update" on public.leagues;

create policy "anon read" on public.leagues for select using (true);

-- 3. Broadcast row changes over the Realtime channel
alter publication supabase_realtime add table public.leagues;
