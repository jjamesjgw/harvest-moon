import { NextResponse } from 'next/server';
import { readSession } from '@/lib/session';
import { takeSnapshot } from '@/lib/db/snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Pre-flight snapshot endpoint (#42). Captures the current leagues row into
// leagues_snapshots BEFORE a destructive client action — today, Reset Season
// — so the documented leagues_snapshots recovery flow gets a 'pre-reset' row
// (previously only /api/ingest-results took pre-flight snapshots). The actual
// state write still goes through /api/league; this endpoint only takes the
// recovery point, fail-closed: the caller is expected to abort the
// destructive op if this returns non-OK.

function originAllowed(req) {
  // Mirror /api/league: SameSite=Strict on the session cookie is the primary
  // CSRF defense; the Origin check is belt-and-suspenders, and a same-origin
  // POST that omits Origin is allowed.
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('host');
  if (!host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function POST(req) {
  if (!originAllowed(req)) {
    return NextResponse.json({ ok: false, error: 'bad-origin' }, { status: 403 });
  }

  const session = readSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  // Only the commissioner resets the season, so only the commissioner needs a
  // pre-reset snapshot. Gating here keeps the snapshots table from being
  // writable by any signed-in player.
  if (!session.isAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 }); }

  const reason = typeof body?.reason === 'string' ? body.reason : '';
  // takeSnapshot sanitizes/caps the reason and returns the row count snapshotted
  // (>=1 on success) or null on failure. Default the tag so an empty/odd reason
  // still produces a recognizable recovery row rather than a no-op.
  const rows = await takeSnapshot(reason || 'pre-reset');
  if (rows == null || rows < 1) {
    return NextResponse.json({ ok: false, error: 'snapshot-failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, rows });
}
