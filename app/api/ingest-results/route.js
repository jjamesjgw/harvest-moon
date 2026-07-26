import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { rollupPts } from '@/lib/scoring';
import { parseRaceTime } from '@/lib/utils';
import { DEFAULT_SCHEDULE } from '@/lib/data';
import {
  deriveWikiSlug,
  fetchArticleHtml,
  parseFinalResults,
  buildCupDriverPoints,
} from '@/lib/raceFeed';
import { withSnapshot } from '@/lib/db/snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || 'harvest-moon';

// Module-init env-var guard — same pattern as /api/league (#27). A missing
// or truncated service-role key would silently fall through to anon and be
// denied by RLS; throwing at startup makes this loud. See the 2026-05-17
// incident for the original rationale.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) {
  throw new Error('[ingest-results/route] NEXT_PUBLIC_SUPABASE_URL is missing.');
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.length < 50) {
  throw new Error(
    '[ingest-results/route] SUPABASE_SERVICE_ROLE_KEY is missing or implausibly short ' +
      `(length=${SERVICE_ROLE_KEY?.length ?? 0}).`,
  );
}

// Module-init auth-secret guard — same fail-loud rationale as the service-
// role guard above (#50). authorized() accepts a CRON_SECRET bearer token
// (Vercel cron) OR an INGEST_SECRET header (manual trigger); if BOTH are
// missing it silently returns false and the route 401s every cron run, with
// no signal beyond the easily-overlooked cron-history dashboard. Throwing at
// startup turns that silent ongoing 401 into a loud cold-start failure. If at
// least one secret is set the route stays operable, matching authorized().
const CRON_SECRET = process.env.CRON_SECRET;
const INGEST_SECRET = process.env.INGEST_SECRET;
if (!CRON_SECRET && !INGEST_SECRET) {
  throw new Error(
    '[ingest-results/route] Both CRON_SECRET and INGEST_SECRET are missing — ' +
      'ingest cannot authenticate any caller.',
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Accept either a Vercel cron call (Authorization: Bearer ${CRON_SECRET})
// or a manual call (x-ingest-secret: ${INGEST_SECRET}). Two secrets so
// cron can be revoked without breaking ad-hoc manual triggers.
function authorized(req) {
  const cronSecret = CRON_SECRET;
  const ingestSecret = INGEST_SECRET;
  const auth = req.headers.get('authorization') || '';
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  const given = req.headers.get('x-ingest-secret') || '';
  if (ingestSecret && given) {
    const a = Buffer.from(ingestSecret);
    const b = Buffer.from(given);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

// Does week `wk` already have Cup driverPoints (auto-ingested or manually
// entered)? Used both to pick a target and to re-check, against freshly-read
// state, that the target is still un-ingested before each write attempt.
function hasCupData(state, wk) {
  const ex = (state.weeklyResults || []).find(w => w.wk === wk);
  if (!ex) return false;
  const dp = ex.driverPoints || {};
  return Object.keys(dp).some(k => k.startsWith('Cup:') || /^\d+$/.test(k));
}

// Pick the wk whose race ended ≥4h ago and which doesn't yet have any Cup
// driverPoints. If multiple qualify, take the most recently completed.
function findTargetRace(state, now) {
  const { schedule = [] } = state;
  const year = now.getFullYear();
  const fourHours = 4 * 60 * 60 * 1000;
  // All-Star exhibition weeks are sourced from DEFAULT_SCHEDULE (code), not
  // the persisted state.schedule, because the stored copy can lag code and
  // miss the format flag — the same reason detectActiveTurn reads the code
  // schedule (lib/utils.js).
  const allStarWeeks = new Set(
    DEFAULT_SCHEDULE.filter(s => s.format === 'all-star').map(s => s.wk),
  );
  // hasCupData lives at module scope now (it is also used by the write-retry
  // loop against freshly-read state); only the finalized check is local.
  const isFinalized = (wk) => !!(state.weeklyResults || []).find(w => w.wk === wk)?.finalized;
  let best = null;
  for (const r of schedule) {
    // Never auto-ingest an All-Star exhibition. It has no Cup driverPoints, so
    // hasCupData stays false forever and the week would be re-targeted on every
    // cron run; worse, if the All-Star article ever parsed as a Final Stage
    // table its points would overwrite the 50/0 all-or-nothing scoring and
    // retroactively rewrite season standings.
    if (allStarWeeks.has(r.wk) || r.format === 'all-star') continue;
    // Skip weeks the commissioner has already finalized — their results are
    // locked and must not be re-fetched or overwritten.
    if (isFinalized(r.wk)) continue;
    const start = parseRaceTime(r.date, r.time, year);
    if (!start) continue;
    if ((now - start) < fourHours) continue;
    if (hasCupData(state, r.wk)) continue;
    if (!best || start > best.start) best = { ...r, start };
  }
  return best;
}

// Merge the parsed race results for `target.wk` into `state`, returning the
// new full-state document plus the recomputed pts and Cup-driver count.
// Pure: reads only its arguments, so it can be re-run against a freshly-read
// state on a write-conflict retry without re-fetching Wikipedia. Bonuses and
// overrides are read from the CURRENT row's week (so an admin's concurrent
// bonus edit is honoured on retry rather than reverted to the first read).
function buildIngestState(state, target, parsedResults, now, slug) {
  const existing = state.weeklyResults?.find(w => w.wk === target.wk) || {};
  const cup = buildCupDriverPoints(parsedResults);
  const driverPoints = { ...(existing.driverPoints || {}), ...cup };

  const picks = state.draftHistory?.find(h => h.wk === target.wk)?.picks
    || (target.wk === state.currentWeek ? (state.draftState?.picks || []) : []);

  const pts = rollupPts(
    state.players || [],
    picks,
    driverPoints,
    existing.bonuses || {},
    existing.overrides || {},
  );

  const newRow = {
    ...existing,
    wk: target.wk,
    track: target.track,
    driverPoints,
    pts,
    source: { provider: 'wikipedia', slug, ingestedAt: now.toISOString() },
  };

  const newState = {
    ...state,
    weeklyResults: [
      ...(state.weeklyResults || []).filter(w => w.wk !== target.wk),
      newRow,
    ],
  };

  return { newState, pts, cupCount: Object.keys(cup).length };
}

// How many times to re-read + re-merge + re-attempt the conditional write when
// a concurrent user save lands in our read→write window. Writes in a 6-user
// league are rare and brief, so this converges on attempt 2 in practice; the
// cron's own 4-runs-per-race cadence is the backstop if we ever exhaust it.
const MAX_WRITE_ATTEMPTS = 4;

async function handle(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // First read: pick the target race off the current row. We also capture
  // write_id here as the compare-and-swap baseline for the write below.
  const { data, error } = await admin
    .from('leagues')
    .select('state, write_id')
    .eq('id', LEAGUE_ID)
    .maybeSingle();
  if (error) {
    console.error('[ingest/select]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.state) return NextResponse.json({ skipped: 'no-league-row' });

  const now = new Date();
  const target = findTargetRace(data.state, now);
  if (!target) return NextResponse.json({ skipped: 'no-race-due' });

  const override = data.state.scheduleOverrides?.[target.wk]?.wikiSlug;
  // target.track is required for the name-collision disambiguation added in
  // #79 — two 2026 races share the name "Cook Out 400", so the track is what
  // picks the right Wikipedia article. Dropping this arg silently reintroduces
  // the wk-25 Richmond bug.
  const slug = deriveWikiSlug(target.raceName, now.getFullYear(), override, target.track);

  // Slow external fetch happens exactly once, up front. The parsed results are
  // reused across any conditional-write retries below.
  const fetched = await fetchArticleHtml(slug);
  if (!fetched.ok) return NextResponse.json({ skipped: fetched.reason, wk: target.wk, slug });
  const parsed = parseFinalResults(fetched.html);
  if (!parsed.final) return NextResponse.json({ skipped: parsed.reason, wk: target.wk, slug });

  // Conditional-write loop. Each attempt rebuilds the new document from the
  // FRESHEST read of the row and applies it only if the row is unchanged since
  // that read (upsert_league_if_unchanged). This closes the lost-update window
  // where a user save via /api/league lands between our read and our write:
  // instead of the old unconditional upsert clobbering it with a stale
  // snapshot, we detect the change, re-read, re-merge the parsed results, and
  // retry. write_id is milliseconds (Date.now()) to match client writes so the
  // row's write_id stays in the same magnitude as the CAS RPC expects.
  let readState = data.state;
  let expectedWriteId = data.write_id ?? null;

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    // Re-validate against the state we're about to merge into: if a manual
    // entry (or a prior attempt) already populated this week, there's nothing
    // left to ingest.
    if (hasCupData(readState, target.wk)) {
      return NextResponse.json({ skipped: 'already-ingested', wk: target.wk, slug });
    }

    const built = buildIngestState(readState, target, parsed.results, now, slug);
    const writeId = Date.now();

    // Snapshot before the write so a bad parse or scoring bug can be rolled
    // back from leagues_snapshots. withSnapshot throws if the snapshot fails,
    // so we never overwrite state without a recovery point.
    const { data: rpcResult, error: writeErr } = await withSnapshot(
      `pre-ingest:wk${target.wk}`,
      () => admin.rpc('upsert_league_if_unchanged', {
        p_id: LEAGUE_ID,
        p_state: built.newState,
        p_client_tag: 'ingest-cron',
        p_write_id: writeId,
        p_expected_write_id: expectedWriteId,
      }),
    );
    if (writeErr) {
      console.error('[ingest/cas]', writeErr);
      return NextResponse.json({ error: writeErr.message }, { status: 500 });
    }

    if (rpcResult?.ok === true) {
      // The leagues_notify trigger fires on this update and pushes a
      // "Week N results posted" notification via /api/notify.
      return NextResponse.json({
        ok: true,
        wk: target.wk,
        track: target.track,
        slug,
        cupDrivers: built.cupCount,
        pts: built.pts,
        attempts: attempt,
      });
    }

    // Row changed under us (a concurrent user save) or vanished. Re-read the
    // fresh row and retry the merge against it.
    const reread = await admin
      .from('leagues')
      .select('state, write_id')
      .eq('id', LEAGUE_ID)
      .maybeSingle();
    if (reread.error) {
      console.error('[ingest/reselect]', reread.error);
      return NextResponse.json({ error: reread.error.message }, { status: 500 });
    }
    if (!reread.data?.state) return NextResponse.json({ skipped: 'no-league-row' });
    readState = reread.data.state;
    expectedWriteId = reread.data.write_id ?? null;
  }

  // Exhausted attempts against a persistent concurrent writer. Bail without
  // writing; the next scheduled cron run retries (hasCupData stays false).
  console.warn(`[ingest] write contended for wk${target.wk} after ${MAX_WRITE_ATTEMPTS} attempts`);
  return NextResponse.json({ skipped: 'write-contended', wk: target.wk, slug }, { status: 409 });
}

export async function GET(req)  { return handle(req); }
export async function POST(req) { return handle(req); }
