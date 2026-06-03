import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_ID, CANONICAL_PLAYERS } from '@/lib/constants';
import { createSessionCookie } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Anon-key client. verify_pin is SECURITY DEFINER + granted to anon, so we
// don't need the service role here — keeps least-privilege in this hot path.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

function resolveAccount(rawName) {
  const key = String(rawName || '').trim().toLowerCase();
  if (!key) return null;
  return CANONICAL_PLAYERS.find(p => p.name.toLowerCase() === key) || null;
}

// Vercel terminates TLS and sets x-forwarded-for to a comma-separated list
// with the real client IP first. Fall back to x-real-ip. Returns '' when the
// caller can't be identified (e.g. local dev) — record_login_attempt() lets
// empty IPs through, so login still works.
function clientIp(req) {
  const xff = req.headers.get('x-forwarded-for') || '';
  const first = xff.split(',')[0].trim();
  if (first) return first;
  return (req.headers.get('x-real-ip') || '').trim();
}

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 }); }

  const { name, pin } = body || {};
  if (typeof name !== 'string' || typeof pin !== 'string' || pin.length !== 4) {
    return NextResponse.json({ ok: false, error: 'bad-input' }, { status: 400 });
  }

  // Per-IP throttle (#68) — checked before the bcrypt-bearing verify_pin so a
  // brute-force run is capped regardless of which account name it targets.
  // Fail-open: any limiter error is treated as "allowed" so a DB hiccup never
  // locks the whole league out — the #49 account lockout is the hard backstop.
  try {
    const { data: allowed, error: rlErr } = await supabase.rpc('record_login_attempt', {
      p_ip: clientIp(req),
    });
    if (rlErr) {
      console.error('[login/ratelimit]', rlErr.message);
    } else if (allowed === false) {
      return NextResponse.json({ ok: false, error: 'rate-limited' }, { status: 429 });
    }
  } catch (e) {
    console.error('[login/ratelimit]', e?.message || e);
  }

  // Resolve before calling the RPC so we can sign the cookie with the canonical
  // playerId. The roster is public (visible on the login screen) so there's no
  // info-leak in returning 401 quickly for unknown names.
  const account = resolveAccount(name);
  if (!account) return NextResponse.json({ ok: false }, { status: 401 });

  let verified;
  try {
    const { data, error } = await supabase.rpc('verify_pin', { p_name: name, p_pin: pin });
    if (error) return NextResponse.json({ ok: false, transport: true }, { status: 503 });
    verified = data === true;
  } catch {
    return NextResponse.json({ ok: false, transport: true }, { status: 503 });
  }

  if (!verified) return NextResponse.json({ ok: false }, { status: 401 });

  const cookie = createSessionCookie({
    playerId: account.id,
    name: account.name,
    isAdmin: account.id === ADMIN_ID,
  });
  return NextResponse.json({ ok: true, account }, {
    status: 200,
    headers: { 'Set-Cookie': cookie },
  });
}
