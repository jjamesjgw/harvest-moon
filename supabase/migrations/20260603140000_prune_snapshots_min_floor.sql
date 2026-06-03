-- Add a minimum-count floor to prune_old_snapshots() (db #48).
--
-- The original prune (20260512050000_snapshots.sql) deleted every scheduled
-- snapshot older than 30 days with no floor:
--
--   delete from public.leagues_snapshots
--   where snapshot_at < now() - interval '30 days' and reason = 'scheduled';
--
-- If the daily snapshot cron is paused for >30 days (Supabase billing gap,
-- project paused, or a migration replay), the next prune wipes ALL scheduled
-- snapshots in one pass. Manual snapshots survive, but across a six-month
-- season those can be sparse — leaving the league with no usable recovery
-- point in leagues_snapshots (leagues_history remains, but needs psql).
--
-- Fix: always retain the N most recent scheduled snapshots regardless of age.
-- A row is deleted only if it is scheduled, older than 30 days, AND not among
-- the 7 most recent scheduled snapshots. Seven keeps roughly a week of daily
-- history as a hard floor.
--
-- Note: the table's primary key is `id` (uuid) — the issue's sketch referenced
-- a non-existent `snapshot_id`; this uses the real column. Signature, return
-- value, and SECURITY DEFINER posture are unchanged from the original.

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
  where id in (
    select id
    from public.leagues_snapshots
    where reason = 'scheduled'
    order by snapshot_at desc
    offset 7  -- always keep at least the 7 most recent scheduled snapshots
  )
  and reason = 'scheduled'
  and snapshot_at < now() - interval '30 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
