-- Move the notify URL + secret out of notify_league_changes()'s body and into
-- a service-role-only config table, so the function is fully migration-managed.
--
-- THE PROBLEM
--
-- The baseline ships notify_league_changes() with literal placeholders:
--     url    text := 'REPLACE_WITH_NOTIFY_URL';
--     secret text := 'REPLACE_WITH_NOTIFY_SECRET';
-- and docs/push-setup.md tells you to hand-edit a copy and paste it into the
-- SQL editor — directly contradicting this project's own rule that database
-- changes go through supabase/migrations/ only. Three consequences:
--
--   1. Replaying migrations onto a fresh project produces a trigger that POSTs
--      to the literal string 'REPLACE_WITH_NOTIFY_URL'. Push is then 100%
--      dead and SILENT: net.http_post is called via PERFORM so the result is
--      discarded, pg_net resolves asynchronously, and the failure lands only
--      in net._http_response, which nothing reads. The league UPDATE succeeds,
--      so nobody sees an error — you just quietly stop getting notifications.
--   2. The baseline's header claims it is "idempotent: safe to re-run", which
--      is FALSE today — re-running it would `create or replace` the live,
--      hand-patched function back to placeholders and break production push.
--   3. Rotating NOTIFY_SECRET means re-pasting a hand-edited function body.
--
-- THE FIX
--
-- Store both values in public.app_config and read them at runtime. The
-- function body then contains no secrets, so it is genuinely safe to re-run,
-- rotation becomes one UPDATE, and nothing has to be pasted by hand ever again.
--
-- WHY A CONFIG TABLE RATHER THAN SUPABASE VAULT
--
-- Vault is the more "correct" answer on paper — encrypted at rest, key held
-- outside the database. It was rejected here on risk, not principle: its API
-- has shifted across Supabase versions (vault.create_secret() vs inserting
-- into vault.secrets, reads via vault.decrypted_secrets), it cannot be
-- verified from this repo without a live project, and getting it wrong
-- produces exactly the failure mode this migration exists to eliminate —
-- silent, undetectable dead push. A plain table is boring SQL that either
-- works or fails loudly at apply time.
--
-- The severity also argues for boring: NOTIFY_SECRET only gates the ability to
-- ask /api/notify to fan out push notifications. It is not a credential for
-- data. Anyone who can read this table already holds service-role access and
-- therefore already has the entire league state. Vault remains a clean future
-- upgrade — swap the two selects below for vault reads; nothing else changes.

create table if not exists public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- RLS on with NO policies: anon and authenticated get zero access via
-- PostgREST. Grants revoked too, so the table isn't even reachable before the
-- (absent) row policy is evaluated. service_role bypasses RLS, and the
-- SECURITY DEFINER function below runs as the table owner.
alter table public.app_config enable row level security;
revoke all on table public.app_config from anon;
revoke all on table public.app_config from authenticated;

-- Rewritten to read its configuration instead of carrying it. Behaviour is
-- otherwise identical: same payload, same header, same trigger conditions.
create or replace function public.notify_league_changes()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url    from public.app_config where key = 'notify_url';
  select value into v_secret from public.app_config where key = 'notify_secret';

  -- Fail LOUD (in the Postgres log) rather than POSTing to nowhere. This is
  -- the state a fresh project starts in, and the whole point of this change is
  -- that it stops being invisible. The league write itself must still succeed
  -- — a missing notification config is not a reason to block a draft pick.
  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    raise warning '[notify] app_config missing notify_url/notify_secret — push disabled for this write';
    return new;
  end if;

  perform net.http_post(
    v_url,
    jsonb_build_object('oldState', old.state, 'newState', new.state),
    '{}'::jsonb,
    jsonb_build_object('x-notify-secret', v_secret, 'content-type', 'application/json')
  );
  return new;
end $$;

-- ── REQUIRED FOLLOW-UP — run this IMMEDIATELY after `supabase db push` ──
--
-- This migration cannot seed the values (SQL can't read Vercel env vars), so
-- between applying it and running the insert below, push is disabled and each
-- affected write logs the warning above. Have this ready to paste; the gap
-- should be seconds. Substitute your real values — notify_secret MUST equal
-- the NOTIFY_SECRET env var in Vercel, or /api/notify returns 401.
--
--   insert into public.app_config (key, value) values
--     ('notify_url',    'https://<your-domain>/api/notify'),
--     ('notify_secret', '<the NOTIFY_SECRET value from Vercel>')
--   on conflict (key) do update
--     set value = excluded.value, updated_at = now();
--
-- To rotate the secret later: update Vercel's NOTIFY_SECRET, then re-run the
-- same statement with the new value. No function edit, no paste of SQL you
-- had to hand-modify.
--
-- To verify push is alive end to end:
--   select key, updated_at from public.app_config;              -- both rows present?
--   select status_code, error_msg from net._http_response
--    order by id desc limit 5;                                  -- recent POSTs 2xx?
