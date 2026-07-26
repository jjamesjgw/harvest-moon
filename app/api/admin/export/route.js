import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { readSession } from '@/lib/session';
import { buildExportPayload } from '@/lib/db/leagueExport';

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

// Full league-state export, as a downloadable file.
//
// Why this exists: every recovery mechanism the app has — leagues_history,
// leagues_snapshots, the pg_cron daily snapshot — writes to tables inside the
// SAME Supabase database as public.leagues. If the project is deleted,
// corrupted, paused past retention, or the account is lost, the primary row
// and every "backup" of it vanish together. Migrations restore schema; they
// don't restore a season.
//
// This route is the manual path (tap the URL, save the file). The scheduled
// path is /api/admin/backup, which ships the same payload to a standalone
// backup Supabase project. Both share buildExportPayload so the two can't
// drift apart.
async function handle(req) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const result = await buildExportPayload(admin, LEAGUE_ID);
  if (!result.ok) {
    if (result.error === 'no-league-row') {
      return NextResponse.json({ ok: false, error: 'no-league-row' }, { status: 404 });
    }
    console.error('[admin/export]', result.detail || result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const { payload } = result;
  const body = JSON.stringify(payload, null, 2);
  const filename = `harvest-moon-${LEAGUE_ID}-${payload.exportedAt.slice(0, 10)}.json`;

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
