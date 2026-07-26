-- Harvest Moon — BACKUP PROJECT setup.
--
-- Run this ONCE, in the SQL editor of the SEPARATE Supabase project you use
-- purely for backups. It does NOT belong in supabase/migrations/ — those are
-- applied to the primary project, and this schema lives in a different
-- database entirely. That separation is the whole point: leagues_history,
-- leagues_snapshots and the pg_cron daily snapshot all sit in the same
-- database as the row they protect, so losing that project loses the season
-- and every backup of it at once.
--
-- Written by POST /api/admin/backup (weekly Vercel cron), using
-- BACKUP_SUPABASE_URL + BACKUP_SUPABASE_SERVICE_ROLE_KEY.
--
-- Setup:
--   1. Create a new Supabase project (free tier is ample — see sizing below).
--   2. Run this file in its SQL editor.
--   3. Copy that project's URL and service_role key into the Vercel env vars
--      BACKUP_SUPABASE_URL and BACKUP_SUPABASE_SERVICE_ROLE_KEY.
--   4. Verify: hit /api/admin/backup once while signed in as commissioner and
--      confirm it returns ok:true with backupsStored: 1.

create table if not exists public.league_backups (
  id                bigserial primary key,
  league_id         text        not null,
  -- When the export was taken (set by the app, not the DB, so it reflects the
  -- moment the state was read rather than the moment the insert landed).
  exported_at       timestamptz not null,
  -- The primary row's write_id / updated_at at export time. write_id is the
  -- app's optimistic-concurrency token, so it identifies exactly which
  -- revision of the league this copy corresponds to.
  write_id          bigint,
  source_updated_at timestamptz,
  -- Counts of pins / push_subs on the primary. Their CONTENTS are deliberately
  -- not copied here (bcrypt hashes and push subscription secrets shouldn't be
  -- duplicated into a second database, and both are cheap to re-create). The
  -- counts tell a restore what still needs re-provisioning.
  row_counts        jsonb,
  -- The irreplaceable part: picks, results, draft history, standings.
  state             jsonb       not null,
  created_at        timestamptz not null default now()
);

-- Newest-first lookups per league, which is how you'd ever read this table.
create index if not exists league_backups_league_exported_idx
  on public.league_backups (league_id, exported_at desc);

-- RLS on with NO policies: anon and authenticated get zero access through
-- PostgREST. Only the service-role key (which bypasses RLS) can read or write,
-- and that key lives solely in Vercel env. Backups contain the full league
-- state, so this table should never be reachable from a browser.
alter table public.league_backups enable row level security;

revoke all on table public.league_backups from anon;
revoke all on table public.league_backups from authenticated;
revoke all on sequence public.league_backups_id_seq from anon;
revoke all on sequence public.league_backups_id_seq from authenticated;

-- ── Sizing / retention ────────────────────────────────────────────────
-- A 6-player season's state is on the order of a couple hundred KB, so a
-- weekly backup is ~10MB/year — far inside the free tier. The app inserts
-- only and never deletes: automatic pruning of backups is exactly the kind of
-- code whose bugs surface only when you finally need the backup. If it ever
-- does matter, prune BY HAND with something like this (keeps the newest 52
-- per league):
--
--   delete from public.league_backups b
--    where b.id not in (
--      select id from (
--        select id, row_number() over (partition by league_id order by exported_at desc) rn
--          from public.league_backups
--      ) r where r.rn <= 52
--    );
--
-- ── Restoring ─────────────────────────────────────────────────────────
-- Pull the state JSON from here:
--   select exported_at, write_id, state
--     from public.league_backups
--    where league_id = 'harvest-moon'
--    order by exported_at desc limit 10;
--
-- Then write it back on the PRIMARY project (the GUC bypasses the fresh-shape
-- guard; set client_tag so open tabs don't suppress the realtime event as
-- their own echo, and bump write_id so the CAS predicate accepts it):
--   begin;
--   set local harvest_moon.allow_wipe = 'true';
--   update public.leagues
--      set state      = '<paste state JSON>'::jsonb,
--          client_tag = 'restore-' || now(),
--          write_id   = (extract(epoch from now()) * 1000)::bigint
--    where id = 'harvest-moon';
--   commit;
