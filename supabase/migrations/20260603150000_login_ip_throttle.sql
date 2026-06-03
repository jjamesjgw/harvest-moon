-- Per-IP rate limiting for PIN login (audit #68, layer 2 of #49).
--
-- The #49 account lockout (verify_pin) stops sustained brute force against a
-- single account, but an attacker can spread guesses across the 6 known
-- account names, or deliberately trip lockouts as a nuisance. A per-IP cap on
-- total attempt volume blunts both.
--
-- Implemented in Postgres rather than Upstash/Redis (the issue's suggestion):
-- the app already runs on Supabase, so a tiny table + SECURITY DEFINER RPC
-- adds the throttle with no new dependency, no external infra, and no new env
-- vars. The login route (app/api/auth/login/route.js) uses the anon key and
-- already calls verify_pin as anon, so the RPC is granted to anon the same way.
--
-- Tunables (constants in the function body):
--   v_window = 5 minutes
--   v_max    = 10 attempts per IP per window
--
-- Fail-open posture: the route treats any RPC error as "allowed" (see the
-- route change) so a limiter problem never locks the whole league out — the
-- #49 account lockout remains the hard backstop.

-- ── attempts table ─────────────────────────────────────────
-- One row per recorded (non-throttled) login attempt. RLS on with no policies
-- = service-role / SECURITY DEFINER only; the anon login flow reaches it only
-- through record_login_attempt() below, never directly.
create table if not exists public.auth_login_attempts (
  id           bigserial primary key,
  ip           text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_auth_login_attempts_ip_at
  on public.auth_login_attempts (ip, attempted_at desc);

alter table public.auth_login_attempts enable row level security;

revoke all on table public.auth_login_attempts from anon, authenticated;

-- ── record_login_attempt(ip) ───────────────────────────────
-- Returns true if the caller is under the limit (and records the attempt),
-- false if the IP has already hit the cap within the window (and does NOT
-- record, so a sustained attack can't grow the table without bound). Empty/
-- unknown IPs are allowed through — they can't be rate-limited meaningfully
-- and the account lockout still applies.
create or replace function public.record_login_attempt(p_ip text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window constant interval := interval '5 minutes';
  v_max    constant int      := 10;
  v_count  int;
begin
  if p_ip is null or length(btrim(p_ip)) = 0 then
    return true;
  end if;

  -- Opportunistic housekeeping: drop this IP's attempts that have aged out of
  -- the window so the table stays small without a separate cron.
  delete from public.auth_login_attempts
   where ip = p_ip and attempted_at < now() - v_window;

  select count(*) into v_count
    from public.auth_login_attempts
   where ip = p_ip and attempted_at >= now() - v_window;

  if v_count >= v_max then
    return false;
  end if;

  insert into public.auth_login_attempts (ip) values (p_ip);
  return true;
end;
$$;

-- Anon calls this from the login route (same surface as verify_pin).
grant execute on function public.record_login_attempt(text) to anon, authenticated;
