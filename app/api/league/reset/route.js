import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readSession } from '@/lib/session';
import { withSnapshot } from '@/lib/db/snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEAGUE_ID = process.env.NEXT_PUBLIC_LEAGUE_ID || 'harvest-moon';

// Same module-init env guard as /api/league — a missing/truncated service-role
// key must fail loud, not silently fall through to anon (see the 2026-05-17
// incident).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) {
  throw new Error('[league/reset/route] NEXT_PUBLIC_SUPABASE_URL is missing.');
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.length < 50) {
  throw new Error(
    '[league/reset/route] SUPABASE_SERVICE_ROLE_KEY is missing or implausibly short ' +
      `(length=${SERVICE_ROLE_KEY?.length ?? 0}).`,
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function originAllowed(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('host');
  if (!host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

// True when an rpc error means the function isn't in the schema yet (migration
// not applied). PostgREST surfaces this as PGRST202; Postgres as 42883.
function isMissingFunction(error) {
  if (!error) return false;
  const code = error.code || '';
  const blob = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    /reset_league/i.test(blob) ||
    /could not find the function|schema cache/i.test(blob)
  );
}

// Sanctioned season reset (#67). Separate from /api/league because a reset must
// be allowed to write structurally fresh-shaped state (when no player has a
// favDriverNum) — which the fresh-shape guards on the normal path refuse. Takes
// a verified pre-reset snapshot (leagues_snapshots) first, fail-closed, then
// wipes via reset_league, which sets harvest_moon.allow_wipe so the
// leagues_pre_update_guard trigger permits the write (still logging OLD state
// to leagues_history). Admin-only.
export async function POST(req) {
  if (!originAllowed(req)) {
    return NextResponse.json({ ok: false, error: 'bad-origin' }, { status: 403 });
  }

  const session = readSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 }); }

  const { state, write_id, client_tag, preResetWeek } = body || {};
  if (state == null || typeof state !== 'object') {
    return NextResponse.json({ ok: false, error: 'bad-state' }, { status: 400 });
  }
  if (typeof write_id !== 'number') {
    return NextResponse.json({ ok: false, error: 'bad-write-id' }, { status: 400 });
  }
  const tag = (typeof client_tag === 'string' && client_tag) ? client_tag : 'reset';
  const reason = `pre-reset:wk${preResetWeek ?? ''}`;

  // Snapshot first (withSnapshot throws if it can't be taken → fail closed),
  // then the sanctioned wipe.
  let rpcResult;
  try {
    rpcResult = await withSnapshot(reason, async () => {
      let { data, error } = await admin.rpc('reset_league', {
        p_id: LEAGUE_ID, p_state: state, p_client_tag: tag, p_write_id: write_id,
      });
      // Deploy-before-migrate safety: if reset_league isn't present yet, fall
      // back to the standard CAS upsert. That still resets correctly in the
      // common case (state not fresh-shaped); only the no-favDriverNum edge
      // needs reset_league and waits for the migration to be applied.
      if (isMissingFunction(error)) {
        ({ data, error } = await admin.rpc('upsert_league_with_cas', {
          p_id: LEAGUE_ID, p_state: state, p_client_tag: tag, p_write_id: write_id,
        }));
      }
      if (error) throw error;
      return data;
    });
  } catch (e) {
    console.error('[league/reset]', e?.message || e);
    return NextResponse.json({ ok: false, error: 'reset-failed' }, { status: 502 });
  }

  if (!rpcResult || rpcResult.ok !== true) {
    // Stale reset — a newer state already landed. Client should pull fresh.
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
