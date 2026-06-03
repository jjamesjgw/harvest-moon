-- PIN login account lockout (audit #49).
--
-- Closes the brute-force vector on the 4-digit PIN space. Before this
-- migration verify_pin() did a bare bcrypt compare with no failure
-- tracking: an attacker who knows an account name (names are visible on
-- the login screen) could exhaust all 10,000 combinations in ~10-17
-- minutes against the /api/auth/login route, which has no IP throttle
-- or lockout of its own.
--
-- Fix: track failed attempts per account on the pins table and arm a
-- timed lockout once a threshold is crossed. All of it lives inside the
-- existing SECURITY DEFINER verify_pin() RPC, so there are no Node.js,
-- route, or client changes — the route still just sees a boolean.
--
-- Tunables (constants in the function body):
--   max_attempts = 5      consecutive failures before lockout
--   lockout      = 15 min  cooldown; auto-expires, no manual unlock
--
-- Effect on the attack: 5 tries per 15-minute window turns a ~15-minute
-- exhaustion into ~20+ days of sustained attempts per account.
--
-- Tradeoff (accepted for this 6-user private app): an attacker can
-- deliberately lock a known account out for 15 minutes by failing 5
-- times. Lockout is per-account and self-healing, so the blast radius is
-- a short, self-resolving denial — far cheaper than account takeover.
-- A "locked, try again later" message for legit users would need the RPC
-- to return a richer shape and the route/client to surface it; that is a
-- separate UX concern, intentionally out of scope here.

-- ── schema: failure-tracking columns on pins ───────────────
-- RLS on public.pins still denies all anon/authenticated access; only
-- the definer-owned verify_pin() below reads or writes these columns.
alter table public.pins
  add column if not exists failed_attempts int not null default 0;
alter table public.pins
  add column if not exists locked_until timestamptz;

-- ── verify_pin: same boolean contract, now with lockout ────
-- SECURITY DEFINER so it can read/write the RLS-locked pins table.
-- extensions.crypt is fully qualified because pgcrypto lives in the
-- `extensions` schema on Supabase, not `public`.
create or replace function public.verify_pin(p_name text, p_pin text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  rec          record;
  v_name       text     := lower(trim(p_name));
  v_match      boolean;
  v_attempts   int;
  max_attempts constant int      := 5;
  lockout      constant interval := interval '15 minutes';
begin
  if p_name is null or p_pin is null then return false; end if;
  if length(p_pin) <> 4 then return false; end if;

  -- Take a row lock so concurrent attempts serialize on the counter
  -- instead of racing it (two parallel wrong guesses can't both read 4
  -- and both write 5, skipping the lockout).
  select name, pin_hash, failed_attempts, locked_until
    into rec
    from public.pins
   where name = v_name
   for update;

  -- Unknown account: no row to update, and no enumeration signal —
  -- identical false to a wrong PIN.
  if rec.name is null then return false; end if;

  -- Active lockout: reject without spending a bcrypt compare, even if
  -- the PIN is correct. The window auto-expires.
  if rec.locked_until is not null and rec.locked_until > now() then
    return false;
  end if;

  -- An expired lockout starts a fresh counting window.
  v_attempts := rec.failed_attempts;
  if rec.locked_until is not null and rec.locked_until <= now() then
    v_attempts := 0;
  end if;

  v_match := extensions.crypt(p_pin, rec.pin_hash) = rec.pin_hash;

  if v_match then
    -- Success clears all accumulated failure state.
    update public.pins
       set failed_attempts = 0,
           locked_until    = null
     where name = v_name;
    return true;
  end if;

  -- Failure: increment within the current window and arm a lockout once
  -- the threshold is reached. Below the threshold, locked_until is set
  -- to null (also clearing a just-expired stamp).
  v_attempts := v_attempts + 1;
  update public.pins
     set failed_attempts = v_attempts,
         locked_until    = case
                             when v_attempts >= max_attempts then now() + lockout
                             else null
                           end
   where name = v_name;
  return false;
end;
$$;

-- Grants are unchanged from the baseline (anon + authenticated may
-- EXECUTE; the pins table itself stays revoked), re-asserted here so this
-- migration is self-contained if replayed against a fresh database.
grant execute on function public.verify_pin(text, text) to anon, authenticated;
revoke all on table public.pins from anon, authenticated;
