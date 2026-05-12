// Server-only snapshot helpers. Wraps the snapshot_leagues() SQL function so
// route handlers can take a pre-flight snapshot before any state-mutating
// operation. NEVER import from client code — this uses the service-role key
// which must not enter the browser bundle.
//
// Background: the snapshot_leagues() function (defined in
// supabase/migrations/20260512050000_snapshots.sql) is SECURITY DEFINER and
// writes one row per league into public.leagues_snapshots. RLS denies anon
// reads of that table, so only the service-role key can drive this flow.

import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// Constrain reason to a short, predictable shape so the snapshots table
// doesn't accumulate free-form text. Allowed chars: alphanumerics plus a few
// common separators that show up in tags like "pre-ingest:wk14".
function sanitizeReason(input) {
  const raw = String(input ?? '').trim();
  return raw.replace(/[^A-Za-z0-9_:.\-]/g, '').slice(0, 64);
}

// Calls snapshot_leagues(p_reason). Returns the number of rows snapshotted
// (currently always 1 for Harvest Moon) on success, or null on failure.
export async function takeSnapshot(reason) {
  const tag = sanitizeReason(reason);
  if (!tag) return null;
  const { data, error } = await admin.rpc('snapshot_leagues', { p_reason: tag });
  if (error) {
    console.error('[snapshot] rpc error:', error.message);
    return null;
  }
  return typeof data === 'number' ? data : 0;
}

// Wraps a destructive operation. Takes a snapshot first; throws if the
// snapshot fails (fail-closed — never mutate state without a recovery point).
// Returns whatever `op` returns.
//
// Usage:
//   const { error } = await withSnapshot('pre-ingest-results', () =>
//     admin.from('leagues').upsert(...)
//   );
export async function withSnapshot(reason, op) {
  const count = await takeSnapshot(reason);
  if (count == null || count < 1) {
    throw new Error(
      `[snapshot] refused to proceed without snapshot (reason=${reason}, count=${count})`,
    );
  }
  console.log(`[snapshot] taken (reason=${reason}, rows=${count})`);
  return op();
}
