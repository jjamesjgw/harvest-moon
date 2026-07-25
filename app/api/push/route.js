import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Module-init env-var guard — same fail-loud pattern as /api/league (#27).
// A missing or truncated service-role key would silently fall through to anon
// and be denied by RLS; throwing at startup makes it a loud cold-start failure
// instead of a mystery "notifications won't turn on".
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) {
  throw new Error('[push/route] NEXT_PUBLIC_SUPABASE_URL is missing.');
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.length < 50) {
  throw new Error(
    '[push/route] SUPABASE_SERVICE_ROLE_KEY is missing or implausibly short ' +
      `(length=${SERVICE_ROLE_KEY?.length ?? 0}).`,
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function originAllowed(req) {
  // SameSite=Strict on the session cookie is the primary CSRF defense; an
  // Origin check is belt-and-suspenders. Same-origin POSTs sometimes omit
  // Origin, so a missing header is allowed. Mirrors /api/league.
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('host');
  if (!host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

// Push endpoints are absolute https URLs issued by the browser's push service
// (FCM, Mozilla, Apple). Reject anything else before it reaches the table.
function validEndpoint(v) {
  if (typeof v !== 'string' || v.length < 10 || v.length > 2048) return false;
  try { return new URL(v).protocol === 'https:'; } catch { return false; }
}

function validKey(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= 512;
}

// POST — subscribe (upsert this device's push subscription).
//
// player_id is taken from the SIGNED SESSION COOKIE, never from the request
// body. That's the whole point of routing this through a handler: previously
// the browser wrote push_subs directly with the public anon key, so anyone
// could insert a row claiming any player_id and receive that player's targeted
// "you're on the clock" pushes.
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

  const { endpoint, p256dh, auth } = body || {};
  if (!validEndpoint(endpoint) || !validKey(p256dh) || !validKey(auth)) {
    return NextResponse.json({ ok: false, error: 'bad-subscription' }, { status: 400 });
  }

  const { error } = await admin.from('push_subs').upsert({
    player_id: session.playerId,
    endpoint,
    p256dh,
    auth,
  }, { onConflict: 'endpoint' });

  if (error) {
    console.error('[push/subscribe]', error);
    return NextResponse.json({ ok: false, error: 'persist-failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE — unsubscribe this device.
//
// Scoped by endpoint alone rather than (endpoint, player_id): the caller has
// proven possession of the endpoint by holding the browser subscription, and
// a device's row carries whichever player subscribed most recently on it. If a
// phone is shared and the row was last written by a different player, matching
// on player_id too would silently leave a live row pushing to a device that
// just opted out — the worse failure. A valid session is still required, so
// this is no longer reachable by the public anon key.
export async function DELETE(req) {
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

  const { endpoint } = body || {};
  if (!validEndpoint(endpoint)) {
    return NextResponse.json({ ok: false, error: 'bad-endpoint' }, { status: 400 });
  }

  const { error } = await admin.from('push_subs').delete().eq('endpoint', endpoint);
  if (error) {
    console.error('[push/unsubscribe]', error);
    return NextResponse.json({ ok: false, error: 'delete-failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
