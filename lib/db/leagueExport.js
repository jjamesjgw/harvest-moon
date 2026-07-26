// Server-only. Builds the canonical league-export payload used by both
// /api/admin/export (download a file) and /api/admin/backup (ship a copy to
// the standalone backup Supabase project). NEVER import from client code —
// callers pass in a service-role client.
//
// Exports the league state only — NOT the contents of public.pins or
// public.push_subs. Those hold bcrypt hashes and push subscription secrets;
// copying them into a second database multiplies the places a secret can leak,
// and both are cheap to re-create (re-issue a PIN, re-tap "turn on
// notifications"). A season's picks, results and draft history are the
// irreplaceable part. Row counts are included so a restore can tell at a
// glance what else needs re-provisioning.

export async function buildExportPayload(admin, leagueId) {
  const { data, error } = await admin
    .from('leagues')
    .select('id, state, write_id, updated_at')
    .eq('id', leagueId)
    .maybeSingle();

  if (error) return { ok: false, error: 'select-failed', detail: error.message };
  if (!data?.state) return { ok: false, error: 'no-league-row' };

  // Best-effort counts; a failure here must not block the export itself.
  const countOf = async (table) => {
    try {
      const { count, error: e } = await admin
        .from(table)
        .select('*', { count: 'exact', head: true });
      return e ? null : count;
    } catch { return null; }
  };
  const [pins, pushSubs] = await Promise.all([countOf('pins'), countOf('push_subs')]);

  return {
    ok: true,
    payload: {
      exportedAt: new Date().toISOString(),
      leagueId: data.id,
      write_id: data.write_id,
      updated_at: data.updated_at,
      // Not exported, only counted — see the note above.
      rowCounts: { pins, push_subs: pushSubs },
      state: data.state,
    },
  };
}
