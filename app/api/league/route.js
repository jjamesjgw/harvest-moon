import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isFreshShaped } from '@/lib/leagueGuards';
import { readSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || 'harvest-moon';

// Service-role client — bypasses RLS so we can write even after the policies
// are tightened to "anon: SELECT only." This is the whole point of moving
// writes through a route handler.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function originAllowed(req) {
  // SameSite=Strict on the session cookie is the primary CSRF defense; an
  // Origin check is belt-and-suspenders. Same-origin POSTs sometimes omit
  // Origin, so a missing header is allowed.
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

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 }); }

  const { state, write_id, client_tag } = body || {};
  if (state == null || typeof state !== 'object') {
    return NextResponse.json({ ok: false, error: 'bad-state' }, { status: 400 });
  }
  if (typeof write_id !== 'number') {
    return NextResponse.json({ ok: false, error: 'bad-write-id' }, { status: 400 });
  }
  if (typeof client_tag !== 'string' || !client_tag) {
    return NextResponse.json({ ok: false, error: 'bad-client-tag' }, { status: 400 });
  }

  // Defense in depth: never let a fresh-shaped state overwrite a populated
  // row. The client gates this too, but the DB boundary is the last line.
  if (isFreshShaped(state)) {
    const { data: existing, error: selErr } = await admin.from('leagues')
      .select('write_id')
      .eq('id', LEAGUE_ID)
      .maybeSingle();
    if (selErr) {
      return NextResponse.json({ ok: false, error: 'preflight-failed' }, { status: 502 });
    }
    if (existing?.write_id != null) {
      return NextResponse.json(
        { ok: false, error: 'refused-fresh-over-populated' },
        { status: 409 },
      );
    }
  }

  const { error } = await admin.from('leagues').upsert({
    id: LEAGUE_ID,
    state,
    client_tag,
    write_id,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'upsert-failed' },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, write_id });
}
