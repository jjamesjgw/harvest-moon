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

  // CAS upsert via RPC. The function returns a jsonb shape that
  // distinguishes a successful write from a stale-write rejection
  // (incoming write_id <= existing row's write_id). Stale writes get
  // surfaced as 409 so the client can drop its pending blob, pull
  // fresh, and stop trying to re-apply pre-remote local state. Closes
  // the #40-class race family at the database boundary — even if a
  // client's pending POST survives PR #41's debounce-cancel (already
  // in-flight when realtime arrives), the server refuses to apply it.
  // See supabase/migrations/20260521010000_league_cas_rpc.sql.
  const { data: rpcResult, error } = await admin.rpc('upsert_league_with_cas', {
    p_id: LEAGUE_ID,
    p_state: state,
    p_client_tag: client_tag,
    p_write_id: write_id,
  });
  if (error) {
    console.error('[league/cas]', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'cas-failed' },
      { status: 502 },
    );
  }
  if (!rpcResult || rpcResult.ok !== true) {
    // Stale write: a concurrent peer's update with a newer write_id has
    // already landed. Caller should drop its pending blob and pull fresh;
    // realtime will eventually deliver the winning row, but the explicit
    // 409 + server_write_id lets the client converge immediately.
    return NextResponse.json(
      {
        ok: false,
        error: rpcResult?.error || 'stale-write',
        server_write_id: rpcResult?.server_write_id ?? null,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, write_id: rpcResult.write_id });
}
