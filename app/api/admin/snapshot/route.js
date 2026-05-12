import { NextResponse } from 'next/server';
import { readSession } from '@/lib/session';
import { takeSnapshot } from '@/lib/db/snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manual snapshot endpoint. Admin-only via the existing hm_session cookie's
// isAdmin flag (set during PIN login). Returns the row count from
// snapshot_leagues(); stored reason is prefixed with "admin:" so it is
// obvious where the snapshot came from when querying leagues_snapshots.
async function handle(req) {
  const session = readSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const reasonRaw = (url.searchParams.get('reason') || 'manual').trim();
  if (!reasonRaw) {
    return NextResponse.json({ ok: false, error: 'bad-reason' }, { status: 400 });
  }

  const fullReason = `admin:${reasonRaw}`;
  const count = await takeSnapshot(fullReason);
  if (count == null) {
    return NextResponse.json({ ok: false, error: 'snapshot-failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, reason: fullReason, rows: count });
}

export async function GET(req)  { return handle(req); }
export async function POST(req) { return handle(req); }
