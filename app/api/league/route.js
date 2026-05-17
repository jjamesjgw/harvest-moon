import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isFreshShaped } from '@/lib/leagueGuards';
import { readSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || 'harvest-moon';

// Module-init env-var guard. A missing or visibly truncated service-role key
// makes every write fail closed (anon JWT falls through to anon role, which
// is SELECT-only by RLS) and the only signal is a 502 with no body — see the
// 2026-05-17 incident. Throwing here turns a silent prod outage into a loud
// startup failure. The 50-char threshold catches empty/missing/obvious
// truncation; real Supabase service_role JWTs are ~210 chars.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) {
  throw new Error('[league/route] NEXT_PUBLIC_SUPABASE_URL is missing.');
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.length < 50) {
  throw new Error(
    '[league/route] SUPABASE_SERVICE_ROLE_KEY is missing or implausibly short ' +
      `(length=${SERVICE_ROLE_KEY?.length ?? 0}).`,
  );
}

// Service-role client — bypasses RLS so we can write even after the policies
// are tightened to "anon: SELECT only." This is the whole point of moving
// writes through a route handler.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

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
      console.error('[league/preflight]', selErr);
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
    console.error('[league/upsert]', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'upsert-failed' },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, write_id });
}
