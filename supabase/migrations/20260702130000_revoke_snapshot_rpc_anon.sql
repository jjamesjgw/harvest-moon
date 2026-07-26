-- Lock the snapshot RPCs off the anon PostgREST surface.
--
-- snapshot_leagues(text) and prune_old_snapshots() were created SECURITY
-- DEFINER in the exposed `public` schema (20260512050000_snapshots.sql) with
-- no EXECUTE revocation, so PostgreSQL's default grant to PUBLIC left them
-- callable by the anon role at /rest/v1/rpc/* with the browser-shipped
-- NEXT_PUBLIC_SUPABASE_ANON_KEY. That bypasses the isAdmin gate in
-- app/api/admin/snapshot/route.js: anyone could invoke snapshot_leagues with
-- an arbitrary reason, and since prune_old_snapshots only deletes
-- reason='scheduled' rows, those attacker rows are retained forever
-- (unbounded snapshot-table growth).
--
-- Sibling RPCs already do exactly this: upsert_league_with_cas
-- (20260521010000) and reset_league (20260603160000) both revoke from
-- public/anon and grant only service_role. These two functions were missed.
--
-- Legit callers are unaffected:
--   • pg_cron jobs (daily-leagues-snapshot, weekly-snapshot-prune) run as the
--     function owner, which can always execute regardless of grants.
--   • lib/db/snapshot.js (withSnapshot / takeSnapshot) calls snapshot_leagues
--     through the service-role key — preserved by the explicit grants below.
-- Idempotent: revoke/grant are safe to re-run.

revoke all on function public.snapshot_leagues(text) from public;
revoke all on function public.snapshot_leagues(text) from anon;
revoke all on function public.snapshot_leagues(text) from authenticated;
grant execute on function public.snapshot_leagues(text) to service_role;

revoke all on function public.prune_old_snapshots() from public;
revoke all on function public.prune_old_snapshots() from anon;
revoke all on function public.prune_old_snapshots() from authenticated;
grant execute on function public.prune_old_snapshots() to service_role;
