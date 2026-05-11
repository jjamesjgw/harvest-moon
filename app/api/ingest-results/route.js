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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || 'harvest-moon';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// Accept either a Vercel cron call (Authorization: Bearer ${CRON_SECRET})
// or a manual call (x-ingest-secret: ${INGEST_SECRET}). Two secrets so
// cron can be revoked without breaking ad-hoc manual triggers.
function authorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  const ingestSecret = process.env.INGEST_SECRET;
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  // Preserve any bonuses / overrides the admin may have already entered for
  // this week. Replace Cup driverPoints with fetched values.
  const existing = state.weeklyResults?.find(w => w.wk === target.wk) || {};
  const cup = buildCupDriverPoints(parsed.results);
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

  const writeId = Math.floor(Date.now() / 1000);
  const { error: writeErr } = await admin.from('leagues').upsert({
    id: LEAGUE_ID,
    state: newState,
    client_tag: 'ingest-cron',
    write_id: writeId,
    updated_at: now.toISOString(),
  });
  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });

  // The leagues_notify trigger fires on this upsert and pushes a
  // "Week N results posted" notification via /api/notify.
  return NextResponse.json({
    ok: true,
    wk: target.wk,
    track: target.track,
    slug,
    cupDrivers: Object.keys(cup).length,
    pts,
  });
}

export async function GET(req)  { return handle(req); }
export async function POST(req) { return handle(req); }
