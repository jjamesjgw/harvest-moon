import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { rollupPts } from '@/lib/scoring';
import { parseRaceTime } from '@/lib/utils';
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

// Pick the wk whose race ended ≥4h ago and which doesn't yet have any Cup
// driverPoints (auto-ingested or manually entered). If multiple qualify,
// take the most recently completed.
function findTargetRace(state, now) {
  const { schedule = [], weeklyResults = [] } = state;
  const year = now.getFullYear();
  const fourHours = 4 * 60 * 60 * 1000;
  const hasCupData = (wk) => {
    const ex = weeklyResults.find(w => w.wk === wk);
    if (!ex) return false;
    const dp = ex.driverPoints || {};
    return Object.keys(dp).some(k => k.startsWith('Cup:') || /^\d+$/.test(k));
  };
  let best = null;
  for (const r of schedule) {
    const start = parseRaceTime(r.date, r.time, year);
    if (!start) continue;
    if ((now - start) < fourHours) continue;
    if (hasCupData(r.wk)) continue;
    if (!best || start > best.start) best = { ...r, start };
  }
  return best;
}

async function handle(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await admin
    .from('leagues')
    .select('state')
    .eq('id', LEAGUE_ID)
    .maybeSingle();
  if (error) {
    console.error('[ingest/select]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.state) return NextResponse.json({ skipped: 'no-league-row' });

  const state = data.state;
  const now = new Date();
  const target = findTargetRace(state, now);
  if (!target) return NextResponse.json({ skipped: 'no-race-due' });

  const override = state.scheduleOverrides?.[target.wk]?.wikiSlug;
  const slug = deriveWikiSlug(target.raceName, now.getFullYear(), override);

  const fetched = await fetchArticleHtml(slug);
  if (!fetched.ok) return NextResponse.json({ skipped: fetched.reason, wk: target.wk, slug });
  const parsed = parseFinalResults(fetched.html);
  if (!parsed.final) return NextResponse.json({ skipped: parsed.reason, wk: target.wk, slug });

  const cup = buildCupDriverPoints(parsed.results);

  // Merge the fetched Cup points onto a base state, preserving any bonuses /
  // overrides the admin already entered for the week. Kept as a function so it
  // can be recomputed against a freshly re-read row if a concurrent client
  // write forces a CAS retry (below).
  const buildIngestedState = (baseState) => {
    const existing = baseState.weeklyResults?.find(w => w.wk === target.wk) || {};
    const driverPoints = { ...(existing.driverPoints || {}), ...cup };
    const picks = baseState.draftHistory?.find(h => h.wk === target.wk)?.picks
      || (target.wk === baseState.currentWeek ? (baseState.draftState?.picks || []) : []);
    const pts = rollupPts(
      baseState.players || [],
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
      source: { provider: 'wikipedia', slug, ingestedAt: new Date().toISOString() },
    };
    const newState = {
      ...baseState,
      weeklyResults: [
        ...(baseState.weeklyResults || []).filter(w => w.wk !== target.wk),
        newRow,
      ],
    };
    return { newState, pts };
  };

  // Write through the SAME CAS RPC the client uses (upsert_league_with_cas)
  // with a millisecond write_id — not a plain upsert with a seconds-scale id.
  // The old direct upsert (a) had no concurrency predicate, so a client write
  // landing between our select and write was silently clobbered, and (b) wrote
  // a seconds-scale write_id ~1000x below any client's Date.now() ms id, which
  // let a later stale client write pass the strict-greater CAS and erase the
  // freshly ingested results. See lib/useLeague.js (the ms write_id invariant)
  // and supabase/migrations/20260521010000_league_cas_rpc.sql.
  const casWrite = async (baseState) => {
    const { newState, pts } = buildIngestedState(baseState);
    const { data: rpc, error: rpcErr } = await admin.rpc('upsert_league_with_cas', {
      p_id: LEAGUE_ID,
      p_state: newState,
      p_client_tag: 'ingest-cron',
      p_write_id: Date.now(),
    });
    return { rpc, rpcErr, pts };
  };

  // Snapshot once before the first attempt so a bad parse or scoring bug can be
  // rolled back from leagues_snapshots (fail-closed — withSnapshot throws if the
  // snapshot can't be taken, so we never write without a recovery point).
  let attempt = await withSnapshot(`pre-ingest:wk${target.wk}`, () => casWrite(state));

  // On a stale-write rejection, a client write landed after our initial select.
  // Re-read the winning state, re-merge our Cup results onto it (picking up the
  // client's change instead of reverting it), and retry once — no second
  // snapshot needed.
  if (!attempt.rpcErr && attempt.rpc?.ok !== true) {
    const { data: fresh, error: reselErr } = await admin
      .from('leagues')
      .select('state')
      .eq('id', LEAGUE_ID)
      .maybeSingle();
    if (!reselErr && fresh?.state) {
      attempt = await casWrite(fresh.state);
    }
  }

  if (attempt.rpcErr) {
    console.error('[ingest/cas]', attempt.rpcErr);
    return NextResponse.json({ error: attempt.rpcErr.message }, { status: 500 });
  }
  if (attempt.rpc?.ok !== true) {
    // Still stale after one retry — a client is actively winning writes. Safe to
    // defer: the week still lacks Cup data, so the next cron tick re-ingests
    // (findTargetRace is idempotent). Not an error.
    return NextResponse.json({
      skipped: 'stale-write',
      wk: target.wk,
      server_write_id: attempt.rpc?.server_write_id ?? null,
    });
  }

  // The leagues_notify trigger fires on this write and pushes a
  // "Week N results posted" notification via /api/notify.
  return NextResponse.json({
    ok: true,
    wk: target.wk,
    track: target.track,
    slug,
    cupDrivers: Object.keys(cup).length,
    pts: attempt.pts,
  });
}

export async function GET(req)  { return handle(req); }
export async function POST(req) { return handle(req); }
