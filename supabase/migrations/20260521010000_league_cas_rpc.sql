-- League save CAS (compare-and-swap) RPC.
--
-- Replaces the unconditional upsert in app/api/league/route.js with an
-- atomic check: only apply the write if the incoming write_id is
-- strictly greater than the existing row's write_id. Stale writes from
-- a client whose local state predates a teammate's update get rejected
-- with a jsonb-shape error that the route handler converts to HTTP 409.
--
-- Closes the #40-class race family at the source: even if a client's
-- pending write survives PR #41's debounce-cancel (e.g. the POST is
-- already in-flight when realtime arrives, so the request body is
-- already serialized), the server now refuses to apply it. The
-- leagues_pre_update_guard trigger still fires for fresh-shape
-- protection — both layers stack.
--
-- SECURITY DEFINER so the function executes with table-owner rights
-- (bypassing RLS). The route handler at app/api/league/route.js is
-- the only intended caller, gated by the hm_session cookie; EXECUTE
-- is restricted to service_role to keep the RPC off the anon surface.

create or replace function public.upsert_league_with_cas(
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
  -- Atomic conditional update: only apply if the incoming write_id is
  -- strictly greater than the existing one. The WHERE predicate runs
  -- under the row's update lock, so two concurrent CAS writes serialize
  -- naturally — the second one sees the first's write_id and rejects.
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

  -- Update didn't match. Either the row doesn't exist, or the existing
  -- write_id is already >= incoming (stale write). Distinguish the two
  -- so we can return a useful response.
  select write_id into v_existing_write_id
    from public.leagues
   where id = p_id;

  if found then
    return jsonb_build_object(
      'ok', false,
      'error', 'stale-write',
      'server_write_id', v_existing_write_id
    );
  end if;

  -- Row doesn't exist — first-ever write for this league id. Insert it.
  -- ON CONFLICT DO NOTHING handles the rare race where another fresh-init
  -- caller wins the insert; we detect the loss in the re-check below and
  -- report it as stale.
  insert into public.leagues (id, state, client_tag, write_id, updated_at)
  values (p_id, p_state, p_client_tag, p_write_id, now())
  on conflict (id) do nothing;
  get diagnostics v_rows_affected = row_count;

  if v_rows_affected > 0 then
    return jsonb_build_object('ok', true, 'write_id', p_write_id);
  end if;

  -- Lost the insert race. Return whatever the winner wrote.
  select write_id into v_existing_write_id
    from public.leagues
   where id = p_id;

  return jsonb_build_object(
    'ok', false,
    'error', 'stale-write',
    'server_write_id', v_existing_write_id
  );
end;
$$;

-- Lock down EXECUTE so direct anon callers can't bypass the route
-- handler's session-cookie check by hitting the RPC over PostgREST.
-- service_role is the only role the Next.js route uses for writes.
revoke all on function public.upsert_league_with_cas(text, jsonb, text, bigint) from public;
revoke all on function public.upsert_league_with_cas(text, jsonb, text, bigint) from anon;
grant execute on function public.upsert_league_with_cas(text, jsonb, text, bigint) to service_role;
