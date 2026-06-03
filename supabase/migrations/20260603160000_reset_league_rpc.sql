-- Sanctioned season-reset RPC (bug #67).
--
-- A commissioner "Reset Season" clears weeklyResults/draftHistory/draftState.
-- If no player has a favDriverNum, the resulting state is structurally
-- "fresh-shaped" — which the leagues_pre_update_guard trigger blocks with a
-- check_violation (it can't tell a sanctioned reset from the auto-init wipe
-- bug). The trigger's intended escape hatch is the transaction-local GUC
-- harvest_moon.allow_wipe = 'true'; this RPC sets it and performs the write in
-- the same transaction so the trigger permits the wipe. The trigger still
-- logs OLD state to leagues_history first, so the audit trail is preserved.
--
-- Mirrors upsert_league_with_cas (20260521010000) — same strict-greater
-- write_id CAS so a stale reset can't clobber a newer state — but with the
-- allow_wipe set_config and reset-specific intent. SECURITY DEFINER; EXECUTE
-- restricted to service_role (the /api/league/reset route is the only caller,
-- gated by an admin hm_session cookie).
--
-- Pre-flight snapshot into leagues_snapshots is handled by the route via
-- withSnapshot(), matching the ingest path — not duplicated here.

create or replace function public.reset_league(
  p_id text,
  p_state jsonb,
  p_client_tag text,
  p_write_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows_affected integer;
  v_existing_write_id bigint;
begin
  -- Sanction the wipe for this transaction so leagues_pre_update_guard accepts
  -- a fresh-shaped NEW state. is_local = true → scoped to this txn only.
  perform set_config('harvest_moon.allow_wipe', 'true', true);

  update public.leagues
     set state      = p_state,
         client_tag = p_client_tag,
         write_id   = p_write_id,
         updated_at = now()
   where id = p_id
     and (write_id is null or write_id < p_write_id);
  get diagnostics v_rows_affected = row_count;

  if v_rows_affected > 0 then
    return jsonb_build_object('ok', true, 'write_id', p_write_id);
  end if;

  -- No row updated: either a newer write_id already landed (stale reset) or the
  -- row doesn't exist yet.
  select write_id into v_existing_write_id from public.leagues where id = p_id;

  if found then
    return jsonb_build_object(
      'ok', false,
      'error', 'stale-write',
      'server_write_id', v_existing_write_id
    );
  end if;

  -- First-ever write for this league id — insert (no trigger fires on INSERT).
  insert into public.leagues (id, state, client_tag, write_id, updated_at)
  values (p_id, p_state, p_client_tag, p_write_id, now())
  on conflict (id) do nothing;
  get diagnostics v_rows_affected = row_count;

  if v_rows_affected > 0 then
    return jsonb_build_object('ok', true, 'write_id', p_write_id);
  end if;

  -- Lost the insert race — report the winner's write_id as stale.
  select write_id into v_existing_write_id from public.leagues where id = p_id;
  return jsonb_build_object(
    'ok', false,
    'error', 'stale-write',
    'server_write_id', v_existing_write_id
  );
end;
$$;

-- Keep the RPC off the anon/public surface — the admin-gated route is the only
-- intended caller, and it uses the service-role key.
revoke all on function public.reset_league(text, jsonb, text, bigint) from public;
revoke all on function public.reset_league(text, jsonb, text, bigint) from anon;
grant execute on function public.reset_league(text, jsonb, text, bigint) to service_role;
