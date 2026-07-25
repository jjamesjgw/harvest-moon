import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Client crash sink. Writes to console.error, which lands in the Vercel
// runtime logs (Deployments → View Function Logs) — deliberately no vendor,
// no storage, no schema. For a 6-person league this converts "the app is
// broken" into an actual stack trace.
//
// Intentionally NOT session-gated: crashes happen before sign-in too (the
// login screen, the boot skeleton), and those are exactly the ones worth
// seeing. The exposure is log noise rather than data, and it's bounded by the
// origin check plus hard caps on every field below.

function originAllowed(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true; // sendBeacon same-origin requests may omit it
  const host = req.headers.get('host');
  if (!host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

const cap = (v, n) => (typeof v === 'string' ? v.slice(0, n) : undefined);

export async function POST(req) {
  if (!originAllowed(req)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const entry = {
    kind: cap(body?.kind, 40),
    message: cap(body?.message, 500),
    screen: cap(body?.screen, 60),
    meId: cap(body?.meId, 60),
    url: cap(body?.url, 200),
    ua: cap(body?.ua, 300),
    stack: cap(body?.stack, 4000),
  };

  // Single line so it groups cleanly in the Vercel log viewer.
  console.error('[client-error]', JSON.stringify(entry));

  return NextResponse.json({ ok: true });
}
