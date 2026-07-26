import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { readSession } from '@/lib/session';
import { buildExportPayload } from '@/lib/db/leagueExport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || 'harvest-moon';

// ── Primary project (source of truth) ──
// Fail-loud module-init guard, same as every other service-role route (#27).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) {
  throw new Error('[admin/backup] NEXT_PUBLIC_SUPABASE_URL is missing.');
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.length < 50) {
  throw new Error(
    '[admin/backup] SUPABASE_SERVICE_ROLE_KEY is missing or implausibly short ' +
      `(length=${SERVICE_ROLE_KEY?.length ?? 0}).`,
  );
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Backup project (separate Supabase project, separate blast radius) ──
// Deliberately NOT guarded at module init, unlike everything above. The backup
// project is optional infrastructure that may not exist yet at deploy time; a
// missing var here must degrade to "backups not configured", never take the
// whole deployment down at cold start. Checked per-request instead.
const BACKUP_URL = process.env.BACKUP_SUPABASE_URL;
const BACKUP_KEY = process.env.BACKUP_SUPABASE_SERVICE_ROLE_KEY;
const backupConfigured = !!(BACKUP_URL && BACKUP_KEY && BACKUP_KEY.length >= 50);

const backupAdmin = backupConfigured
  ? createClient(BACKUP_URL, BACKUP_KEY, { auth: { persistSession: false } })
  : null;

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Cron (CRON_SECRET bearer), manual trigger (x-ingest-secret), or a signed-in
// commissioner hitting it from the browser.
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

// Ship a full league-state snapshot into the standalone backup project.
//
// The point is blast-radius separation: leagues_history, leagues_snapshots and
// the pg_cron daily snapshot all live in the SAME database as the row they
// protect, so losing that project loses the season and every backup of it at
// once. This writes to a DIFFERENT Supabase project, so a delete, corruption,
// pause-past-retention or account loss on the primary leaves the copies intact.
//
// Insert-only, no pruning. A weekly snapshot of a 6-player season is on the
// order of a couple hundred KB, so a year of backups is ~10MB — far inside the
// free tier. Automatic deletion of backups is exactly the kind of code whose
// bugs are only discovered when you need the backup, so it's deliberately
// absent; prune by hand if it ever matters (see supabase/backup-project-setup.sql).
async function handle(req) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!backupConfigured) {
    // 200, not an error: an unconfigured backup target is a setup state, not a
    // failure, and a cron that 500s every week trains you to ignore it.
    return NextResponse.json({
      ok: false,
      skipped: 'backup-not-configured',
      hint: 'Set BACKUP_SUPABASE_URL and BACKUP_SUPABASE_SERVICE_ROLE_KEY, and run supabase/backup-project-setup.sql on the backup project.',
    });
  }

  const result = await buildExportPayload(admin, LEAGUE_ID);
  if (!result.ok) {
    if (result.error === 'no-league-row') {
      return NextResponse.json({ ok: false, error: 'no-league-row' }, { status: 404 });
    }
    console.error('[admin/backup/read]', result.detail || result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const { payload } = result;
  const { error: writeErr } = await backupAdmin.from('league_backups').insert({
    league_id: payload.leagueId,
    exported_at: payload.exportedAt,
    write_id: payload.write_id,
    source_updated_at: payload.updated_at,
    row_counts: payload.rowCounts,
    state: payload.state,
  });

  if (writeErr) {
    console.error('[admin/backup/write]', writeErr);
    return NextResponse.json({ ok: false, error: 'backup-write-failed' }, { status: 502 });
  }

  // Report the stored count back so a glance at the cron log answers "is this
  // actually accumulating?" — the question that matters for a backup system.
  let stored = null;
  try {
    const { count } = await backupAdmin
      .from('league_backups')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', payload.leagueId);
    stored = count;
  } catch {}

  return NextResponse.json({
    ok: true,
    leagueId: payload.leagueId,
    exportedAt: payload.exportedAt,
    write_id: payload.write_id,
    backupsStored: stored,
  });
}

export async function GET(req)  { return handle(req); }
export async function POST(req) { return handle(req); }
