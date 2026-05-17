-- ============================================================
-- HARVEST MOON BASELINE (squashed)
-- ============================================================
-- Squashed migration capturing the full schema state of Harvest
-- Moon as of 2026-05-12, replacing the prior init_baseline.sql +
-- four tracked migrations (probe_permissions, player_pin_auth,
-- fix_verify_pin_crypt_qualification, tighten_leagues_rls_anon_select_only).
--
-- Intended use: bringing up a fresh Supabase project (e.g. the
-- replaced staging environment). Idempotent: every statement uses
-- `if not exists` / `or replace` / guarded DO blocks, so it is
-- safe to re-run.
--
-- SECRETS: notify_league_changes() contains placeholders for the
-- notify endpoint URL and shared secret. Replace them with the
-- per-environment values from Vercel env (NOTIFY_SECRET) before
-- running, or apply the replacement step documented in
-- docs/staging-supabase-setup.md.
-- ============================================================

-- ── extensions ─────────────────────────────────────────────
create extension if not exists pg_net;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ── auto-RLS event trigger ─────────────────────────────────
-- Enforces row-level security on any newly-created table in the
-- public schema. Defensive: catches the case where someone
-- creates a table without remembering to enable RLS.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL
        AND cmd.schema_name IN ('public')
        AND cmd.schema_name NOT IN ('pg_catalog','information_schema')
        AND cmd.schema_name NOT LIKE 'pg_toast%'
        AND cmd.schema_name NOT LIKE 'pg_temp%'
     THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (system schema or not enforced)', cmd.object_identity;
     END IF;
  END LOOP;
END;
$$;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

-- ── leagues table ──────────────────────────────────────────
create table if not exists public.leagues (
  id          text primary key,
  state       jsonb not null,
  write_id    bigint default 0,
  updated_at  timestamptz default now(),
  client_tag  text
);

alter table public.leagues enable row level security;

-- Anon SELECT only. Writes go through /api/league (service-role
-- key). This is the post-tighten state: anon insert/update were
-- explicitly removed.
drop policy if exists "anon read"   on public.leagues;
drop policy if exists "anon insert" on public.leagues;
drop policy if exists "anon update" on public.leagues;

create policy "anon read" on public.leagues for select using (true);

-- Realtime publication so the client can subscribe to row changes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'leagues'
  ) then
    alter publication supabase_realtime add table public.leagues;
  end if;
end $$;

-- ── leagues_history table ──────────────────────────────────
-- Append-only audit log of every league state mutation. Filled
-- by the leagues_pre_update_guard trigger below on every UPDATE.
create table if not exists public.leagues_history (
  history_id bigserial primary key,
  league_id  text not null,
  state      jsonb not null,
  client_tag text,
  write_id   bigint,
  changed_at timestamptz not null default now()
);

create index if not exists leagues_history_league_id_changed_at_idx
  on public.leagues_history (league_id, changed_at desc);

alter table public.leagues_history enable row level security;

drop policy if exists "anon read"   on public.leagues_history;
drop policy if exists "anon insert" on public.leagues_history;

create policy "anon read"   on public.leagues_history for select using (true);
create policy "anon insert" on public.leagues_history for insert with check (true);

-- ── leagues_pre_update_guard ───────────────────────────────
-- BEFORE-UPDATE trigger on leagues that:
--   1. snapshots OLD state into leagues_history (the audit log)
--   2. refuses to overwrite a populated league with a "fresh-shaped"
--      state (the signature of makeFreshState() output), which would
--      indicate an auto-init bug. Escape hatch:
--        BEGIN;
--        SET LOCAL harvest_moon.allow_wipe = 'true';
--        UPDATE leagues SET ... WHERE id = '...';
--        COMMIT;
create or replace function public.leagues_pre_update_guard()
returns trigger language plpgsql as $$
DECLARE
  old_has_results  boolean;
  old_has_drafts   boolean;
  old_has_picks    boolean;
  new_has_results  boolean;
  new_has_drafts   boolean;
  new_has_picks    boolean;
  new_has_fav_drv  boolean;
  is_fresh_shape   boolean;
BEGIN
  INSERT INTO leagues_history (league_id, state, client_tag, write_id)
  VALUES (OLD.id, OLD.state, OLD.client_tag, OLD.write_id);

  IF current_setting('harvest_moon.allow_wipe', true) = 'true' THEN
    RETURN NEW;
  END IF;

  old_has_results := jsonb_array_length(coalesce(OLD.state->'weeklyResults','[]'::jsonb)) > 0;
  old_has_drafts  := jsonb_array_length(coalesce(OLD.state->'draftHistory','[]'::jsonb))  > 0;
  old_has_picks   := jsonb_array_length(coalesce(OLD.state->'draftState'->'picks','[]'::jsonb)) > 0;

  IF NOT (old_has_results OR old_has_drafts OR old_has_picks) THEN
    RETURN NEW;
  END IF;

  new_has_results := jsonb_array_length(coalesce(NEW.state->'weeklyResults','[]'::jsonb)) > 0;
  new_has_drafts  := jsonb_array_length(coalesce(NEW.state->'draftHistory','[]'::jsonb))  > 0;
  new_has_picks   := jsonb_array_length(coalesce(NEW.state->'draftState'->'picks','[]'::jsonb)) > 0;

  SELECT EXISTS(
    SELECT 1 FROM jsonb_array_elements(coalesce(NEW.state->'players','[]'::jsonb)) p
    WHERE p ? 'favDriverNum'
  ) INTO new_has_fav_drv;

  is_fresh_shape := NOT new_has_results
                AND NOT new_has_drafts
                AND NOT new_has_picks
                AND NOT new_has_fav_drv;

  IF is_fresh_shape THEN
    RAISE EXCEPTION
      'Refused to overwrite league % with fresh-shaped state. OLD row had real data; NEW row looks like a fresh init (auto-init bug?). Snapshot retained in leagues_history.',
      OLD.id
      USING
        HINT = 'If this is an intentional reset, run inside a transaction with: SET LOCAL harvest_moon.allow_wipe = ''true''',
        ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

drop trigger if exists leagues_pre_update_guard on public.leagues;
create trigger leagues_pre_update_guard
  before update on public.leagues
  for each row
  execute function public.leagues_pre_update_guard();

-- ── notify_league_changes ──────────────────────────────────
-- AFTER-UPDATE trigger that POSTs the old + new state to the
-- Next.js /api/notify endpoint. The endpoint computes which
-- web-push events should fire (using lib/utils.js helpers) and
-- fans out the pushes.
--
-- The URL and shared secret MUST be inlined here because
-- Supabase does not permit `alter database ... set app.*`.
-- Replace the two placeholders before running.
create or replace function public.notify_league_changes()
returns trigger language plpgsql security definer as $$
declare
  url    text := 'REPLACE_WITH_NOTIFY_URL';     -- e.g. https://harvest-moon-staging.vercel.app/api/notify
  secret text := 'REPLACE_WITH_NOTIFY_SECRET';  -- must match Vercel env NOTIFY_SECRET for this environment
begin
  perform net.http_post(
    url,
    jsonb_build_object('oldState', old.state, 'newState', new.state),
    '{}'::jsonb,
    jsonb_build_object('x-notify-secret', secret, 'content-type', 'application/json')
  );
  return new;
end $$;

-- Trigger fires only when notify-relevant subtrees change, so
-- profile edits and other unrelated writes don't trigger HTTP calls.
drop trigger if exists leagues_notify on public.leagues;
create trigger leagues_notify
  after update on public.leagues
  for each row
  when (
    new.state->'draftState'->'picks' is distinct from old.state->'draftState'->'picks'
    or new.state->'weeklyResults'     is distinct from old.state->'weeklyResults'
  )
  execute function public.notify_league_changes();

-- ── push_subs table ────────────────────────────────────────
-- Web-push subscription endpoints. Anon writes allowed because the
-- only sensitive data is a per-browser endpoint URL.
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

-- ── pins table (server-side PIN auth) ──────────────────────
-- Hashed PINs. RLS denies all access to anon — only the
-- security-definer verify_pin() function below can read this
-- table. bcrypt at cost factor 8 (cheap to compute but adds
-- meaningful brute-force resistance to the 4-digit space).
create table if not exists public.pins (
  name       text primary key,
  pin_hash   text not null,
  created_at timestamptz default now()
);

alter table public.pins enable row level security;

drop policy if exists "deny all reads"   on public.pins;
drop policy if exists "deny all writes"  on public.pins;
drop policy if exists "deny all updates" on public.pins;
drop policy if exists "deny all deletes" on public.pins;

create policy "deny all reads"   on public.pins for select using (false);
create policy "deny all writes"  on public.pins for insert with check (false);
create policy "deny all updates" on public.pins for update using (false) with check (false);
create policy "deny all deletes" on public.pins for delete using (false);

-- ── verify_pin function ────────────────────────────────────
-- SECURITY DEFINER so it can read the pins table that anon cannot.
-- Returns boolean only — no info about whether the name exists,
-- preventing account enumeration. extensions.crypt is fully
-- qualified because pgcrypto lives in the `extensions` schema on
-- Supabase, not `public`.
create or replace function public.verify_pin(p_name text, p_pin text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  stored text;
begin
  if p_name is null or p_pin is null then return false; end if;
  if length(p_pin) <> 4 then return false; end if;
  select pin_hash into stored from public.pins where name = lower(trim(p_name));
  if stored is null then return false; end if;
  return extensions.crypt(p_pin, stored) = stored;
end;
$$;

-- Allow anon clients to call the function via supabase.rpc('verify_pin').
grant execute on function public.verify_pin(text, text) to anon, authenticated;

-- Revoke direct table grants — only the function reaches the data.
revoke all on table public.pins from anon, authenticated;
