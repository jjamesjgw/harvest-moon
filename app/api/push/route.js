import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Service-role route for web-push subscription writes. Moves push_subs off the
// anon PostgREST surface: previously the table carried an `anon all` RLS
// policy, so anyone with the browser-shipped anon key could read every
// member's endpoint/keys, delete all subscriptions, or insert a row under
// another player_id to receive that player's targeted "your turn" pushes. All
// writes now go through here, gated by the hm_session cookie, and player_id is
// taken from the SESSION — never the request body — so it can't be forged.
// Reads stay server-side in /api/notify (also service role). See migration
// 20260702140000_lock_push_subs_rls.sql.

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

// A push endpoint is a URL that /api/notify will later POST to on the server's
// behalf, so it is not merely a stored string — an unvalidated one turns a
// signed-in member into a request forger. Requiring https also rejects the
// http://169.254.169.254-style internal targets that make SSRF interesting.
// Push services (FCM, Mozilla, Apple, Windows) all issue https URLs, so a
// legitimate browser subscription is never rejected by this.
const MAX_ENDPOINT = 2048;
const MAX_KEY = 256;

function endpointValid(endpoint) {
  if (typeof endpoint !== 'string' || !endpoint || endpoint.length > MAX_ENDPOINT) return false;
  let u;
  try { u = new URL(endpoint); } catch { return false; }
  return u.protocol === 'https:';
}

// Subscribe / refresh this browser's push subscription.
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
  if (!endpointValid(endpoint)) {
    return NextResponse.json({ ok: false, error: 'bad-endpoint' }, { status: 400 });
  }
  // The keys are base64url blobs of fixed size in practice (65 and 16 bytes
  // encoded); the cap just keeps a member from parking megabytes in the row.
  const keyValid = (k) => typeof k === 'string' && !!k && k.length <= MAX_KEY;
  if (!keyValid(p256dh) || !keyValid(auth)) {
    return NextResponse.json({ ok: false, error: 'bad-keys' }, { status: 400 });
  }

  // player_id from the session, NOT the body — a caller can't register a
  // subscription under someone else's id to steal their targeted pushes.
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

// Unsubscribe this browser. Scoped to the caller's own subscriptions so one
// member can't wipe another's by supplying a different endpoint.
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

  // Same shape check as POST. Nothing unsafe can be *stored* by a delete, but
  // an unbounded string here is still a free query against the index.
  const { endpoint } = body || {};
  if (!endpointValid(endpoint)) {
    return NextResponse.json({ ok: false, error: 'bad-endpoint' }, { status: 400 });
  }

  const { error } = await admin.from('push_subs')
    .delete()
    .eq('endpoint', endpoint)
    .eq('player_id', session.playerId);

  if (error) {
    console.error('[push/unsubscribe]', error);
    return NextResponse.json({ ok: false, error: 'delete-failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
