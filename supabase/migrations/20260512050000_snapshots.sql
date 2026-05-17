-- ============================================================
-- Automated daily snapshots of leagues state
-- ============================================================
-- Replaces the original "staging project" recovery strategy. All
-- app state lives in `public.leagues.state` (a single JSONB row
-- per league), so a daily snapshot + a manual pre-flight helper
-- give us the same recovery posture at a fraction of the cost.
--
-- This migration:
--   1. Enables pg_cron
--   2. Creates leagues_snapshots (service-role only via RLS)
--   3. Creates snapshot_leagues(reason) and prune_old_snapshots()
--   4. Schedules a daily snapshot (03:00 UTC) and weekly prune
--      (04:00 UTC Sunday)
--   5. Captures an initial snapshot tagged 'initial-setup'
--
-- Idempotent: safe to re-run. pg_cron's 3-arg cron.schedule(name,
-- schedule, command) replaces an existing job with the same name,
-- so re-applying this migration updates schedules in place.
-- ============================================================

-- ── extension ──────────────────────────────────────────────
-- pg_cron lives in the `cron` schema once enabled. On Supabase
-- this works via SQL; no Dashboard step required.
create extension if not exists pg_cron;

-- ── leagues_snapshots table ────────────────────────────────
-- One row per snapshot per league. `reason` distinguishes the
-- scheduled daily snapshots ('scheduled') from manual pre-flight
-- snapshots ('pre-<descriptive-tag>') and the initial setup row.
-- Manual snapshots are retained forever; only 'scheduled' rows
-- age out via prune_old_snapshots().
create table if not exists public.leagues_snapshots (
  id           uuid primary key default gen_random_uuid(),
  snapshot_at  timestamptz not null default now(),
  league_id    text not null,
  state        jsonb not null,
  write_id     bigint not null,
  reason       text not null default 'scheduled'
);

create index if not exists idx_leagues_snapshots_at
  on public.leagues_snapshots (snapshot_at desc);
create index if not exists idx_leagues_snapshots_league_at
  on public.leagues_snapshots (league_id, snapshot_at desc);

-- RLS on, no policies = service-role only. Snapshots are admin /
-- recovery data, never client-facing.
alter table public.leagues_snapshots enable row level security;

-- ── snapshot_leagues(reason) ───────────────────────────────
-- Copies every row of public.leagues into leagues_snapshots with
-- the provided reason tag. Returns the number of rows inserted
-- (currently always 1 for Harvest Moon, but written to handle
-- multi-league cases if that ever changes).
create or replace function public.snapshot_leagues(p_reason text default 'scheduled')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.leagues_snapshots (league_id, state, write_id, reason)
  select id, state, write_id, p_reason
  from public.leagues;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- ── prune_old_snapshots() ──────────────────────────────────
-- Deletes scheduled snapshots older than 30 days. Manual
-- snapshots (reason != 'scheduled') are kept forever so the
-- "what was state before X" trail is preserved across the life
-- of the league.
create or replace function public.prune_old_snapshots()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.leagues_snapshots
  where snapshot_at < now() - interval '30 days'
    and reason = 'scheduled';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- ── cron jobs ──────────────────────────────────────────────
-- 03:00 UTC = roughly 10pm Central, after race weekend wraps.
-- 04:00 UTC Sunday = an hour after the daily snapshot runs.
-- cron.schedule(name, schedule, command) is idempotent on name:
-- re-running this migration updates the schedule/command without
-- creating duplicates.
select cron.schedule(
  'daily-leagues-snapshot',
  '0 3 * * *',
  $$ select public.snapshot_leagues('scheduled'); $$
);

select cron.schedule(
  'weekly-snapshot-prune',
  '0 4 * * 0',
  $$ select public.prune_old_snapshots(); $$
);

-- ── initial snapshot ───────────────────────────────────────
-- Take one snapshot so the table isn't empty after install.
-- Guarded so re-running the migration doesn't pile up duplicate
-- 'initial-setup' rows.
do $$
begin
  if not exists (
    select 1 from public.leagues_snapshots where reason = 'initial-setup'
  ) then
    perform public.snapshot_leagues('initial-setup');
  end if;
end $$;
