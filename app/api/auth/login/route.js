import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_ID, ADMIN_PROFILE, CANONICAL_PLAYERS } from '@/lib/constants';
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
  if (key === ADMIN_ID) return ADMIN_PROFILE;
  return CANONICAL_PLAYERS.find(p => p.name.toLowerCase() === key) || null;
}

export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 }); }

  const { name, pin } = body || {};
  if (typeof name !== 'string' || typeof pin !== 'string' || pin.length !== 4) {
    return NextResponse.json({ ok: false, error: 'bad-input' }, { status: 400 });
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
