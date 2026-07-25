import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { readSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || 'harvest-moon';

// Module-init env guard — same fail-loud pattern as the other service-role
// routes (#27).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) {
  throw new Error('[admin/export] NEXT_PUBLIC_SUPABASE_URL is missing.');
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.length < 50) {
  throw new Error(
    '[admin/export] SUPABASE_SERVICE_ROLE_KEY is missing or implausibly short ' +
      `(length=${SERVICE_ROLE_KEY?.length ?? 0}).`,
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Two ways in: the commissioner's session cookie (manual "download a backup"),
// or the cron/manual secrets (so this can be scheduled without a browser).
function authorized(req) {
  const session = readSession(req);
  if (session?.isAdmin) return true;

  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  if (cronSecret && auth && safeEqual(auth, `Bearer ${cronSecret}`)) return true;

  const ingestSecret = process.env.INGEST_SECRET;
  const given = req.headers.get('x-ingest-secret') || '';
  if (ingestSecret && given && safeEqual(given, ingestSecret)) return true;

  return false;
}

// Full league-state export.
//
// Why this exists: every recovery mechanism the app has — leagues_history,
// leagues_snapshots, the pg_cron daily snapshot — writes to tables inside the
// SAME Supabase database as public.leagues. If the project is deleted,
// corrupted, paused past retention, or the account is lost, the primary row
// and every "backup" of it vanish together. Migrations restore schema; they
// don't restore a season. The only incidental offsite copies today are each
// phone's localStorage mirror, which was never designed as a backup.
//
// Deliberately exports the league state only — NOT the contents of public.pins
// or public.push_subs. Those hold bcrypt hashes and push subscription secrets;
// copying them around multiplies the places a secret can leak, and both are
// cheap to re-create (re-issue a PIN, re-tap "turn on notifications"). A
// season's picks, results and draft history are the irreplaceable part. Row
// counts are included so a restore can tell at a glance what else needs
// re-provisioning.
async function handle(req) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await admin
    .from('leagues')
    .select('id, state, write_id, updated_at')
    .eq('id', LEAGUE_ID)
    .maybeSingle();

  if (error) {
    console.error('[admin/export]', error);
    return NextResponse.json({ ok: false, error: 'select-failed' }, { status: 502 });
  }
  if (!data?.state) {
    return NextResponse.json({ ok: false, error: 'no-league-row' }, { status: 404 });
  }

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

  const exportedAt = new Date().toISOString();
  const payload = {
    exportedAt,
    leagueId: data.id,
    write_id: data.write_id,
    updated_at: data.updated_at,
    // Not exported, only counted — see the note above.
    rowCounts: { pins, push_subs: pushSubs },
    state: data.state,
  };

  const body = JSON.stringify(payload, null, 2);
  const filename = `harvest-moon-${LEAGUE_ID}-${exportedAt.slice(0, 10)}.json`;

  // Content-Disposition so hitting this from a browser saves a file the
  // commissioner can drop in Drive/iCloud — a copy that survives losing the
  // Supabase project entirely.
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req)  { return handle(req); }
export async function POST(req) { return handle(req); }
