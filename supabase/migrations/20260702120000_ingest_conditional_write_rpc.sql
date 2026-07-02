-- Ingest conditional-write CAS RPC (expected-write_id compare-and-swap).
--
-- The auto-ingest cron (app/api/ingest-results/route.js) does a
-- read-modify-write: it SELECTs the whole league state, performs a slow
-- external Wikipedia fetch (seconds), then writes the recomputed document
-- back. Before this migration that write was an UNCONDITIONAL upsert that
-- bypassed upsert_league_with_cas, so any user save committed through
-- /api/league during the read→fetch→write window was silently clobbered
-- with the ingest's stale pre-fetch snapshot (a classic lost update).
--
-- upsert_league_with_cas can't fix this on its own: its predicate is
-- "incoming write_id STRICTLY GREATER than stored", and the ingest write,
-- stamped at write time, is always newer than the concurrent user write it
-- would overwrite — so CAS would accept it and still lose the edit. What the
-- ingest needs is optimistic concurrency keyed on the value it READ:
-- "apply only if the row is UNCHANGED since I read it." That's this function.
--
-- The route captures the row's write_id at SELECT time and passes it as
-- p_expected_write_id. If a concurrent write landed in between, write_id no
-- longer matches, the UPDATE affects zero rows, and the route re-reads,
-- re-merges the parsed results into the fresh state, and retries. `is not
-- distinct from` so a first-ever row (write_id NULL / default 0) still
-- matches an expected NULL/0.
--
-- SECURITY DEFINER + service_role-only EXECUTE, same posture as
-- upsert_league_with_cas — the ingest route is the only intended caller and
-- this must never reach the anon PostgREST surface.

create or replace function public.upsert_league_if_unchanged(
  p_id text,
  p_state jsonb,
  p_client_tag text,
  p_write_id bigint,
  p_expected_write_id bigint
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
  -- Apply only if the row's write_id is exactly what the caller read. The
  -- WHERE predicate runs under the row's update lock, so a concurrent CAS
  -- write serializes ahead of us and flips write_id, making this match zero
  -- rows instead of clobbering that write.
  update public.leagues
     set state      = p_state,
         client_tag = p_client_tag,
         write_id   = p_write_id,
         updated_at = now()
   where id = p_id
     and write_id is not distinct from p_expected_write_id;
  get diagnostics v_rows_affected = row_count;

  if v_rows_affected > 0 then
    return jsonb_build_object('ok', true, 'write_id', p_write_id);
  end if;

  -- No match. Either the row changed under us (someone wrote after our read)
  -- or the row is gone. Report the current write_id so the caller can re-read
  -- and retry. Unlike upsert_league_with_cas this function never inserts:
  -- the ingest route only ever runs against an already-populated league row.
  select write_id into v_existing_write_id
    from public.leagues
   where id = p_id;

  if found then
    return jsonb_build_object(
      'ok', false,
      'error', 'row-changed',
      'server_write_id', v_existing_write_id
    );
  end if;

  return jsonb_build_object('ok', false, 'error', 'no-row');
end;
$$;

-- Keep the RPC off the anon surface, same as upsert_league_with_cas. Only the
-- service-role Next.js route handler may call it.
revoke all on function public.upsert_league_if_unchanged(text, jsonb, text, bigint, bigint) from public;
revoke all on function public.upsert_league_if_unchanged(text, jsonb, text, bigint, bigint) from anon;
grant execute on function public.upsert_league_if_unchanged(text, jsonb, text, bigint, bigint) to service_role;
