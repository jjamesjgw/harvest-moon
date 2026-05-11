import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { detectActiveTurn } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const vapidReady = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (vapidReady) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function authorized(req) {
  const secret = process.env.NOTIFY_SECRET;
  const given = req.headers.get('x-notify-secret');
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function pickEvents(oldState, newState) {
  const events = [];
  if (!newState) return events;

  const oldPicks = oldState?.draftState?.picks || [];
  const newPicks = newState?.draftState?.picks || [];
  const oldResults = oldState?.weeklyResults || [];
  const newResults = newState?.weeklyResults || [];

  // 1. New pick appeared.
  if (newPicks.length > oldPicks.length) {
    const last = newPicks[newPicks.length - 1];
    const picker = (newState.players || []).find((p) => p.id === last?.playerId);
    if (last && picker) {
      events.push({
        kind: 'pick',
        excludePlayerId: picker.id,
        title: 'Harvest Moon',
        body: `${picker.name} drafted #${last.driverNum} ${last.driverName || ''}`.trim(),
        url: '/?screen=draft',
        tag: `pick-${newPicks.length}`,
      });
    }
  }

  // 2. On-clock changed.
  const newTurn = detectActiveTurn(newState);
  const oldTurn = detectActiveTurn(oldState);
  if (newTurn?.playerId && newTurn.playerId !== oldTurn?.playerId) {
    events.push({
      kind: 'your_turn',
      targetPlayerId: newTurn.playerId,
      title: 'Harvest Moon',
      body: newTurn.kind === 'snake'
        ? `You're on the clock — round ${newTurn.round}`
        : "You're on the clock",
      url: '/?screen=draft',
      tag: `turn-${newTurn.playerId}-${newPicks.length}`,
    });
  }

  // 3. Weekly results posted (array grew).
  if (newResults.length > oldResults.length) {
    const wk = newResults[newResults.length - 1]?.wk ?? newState.currentWeek;
    events.push({
      kind: 'results',
      title: 'Harvest Moon',
      body: `Week ${wk} results posted`,
      url: '/?screen=standings',
      tag: `results-${wk}`,
    });
  }

  return events;
}

async function loadSubs({ targetPlayerId, excludePlayerId }) {
  let q = admin.from('push_subs').select('endpoint, p256dh, auth, player_id');
  if (targetPlayerId) q = q.eq('player_id', targetPlayerId);
  else if (excludePlayerId) q = q.neq('player_id', excludePlayerId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function sendOne(sub, payload) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (err) {
    const status = err?.statusCode;
    if (status === 404 || status === 410) {
      await admin.from('push_subs').delete().eq('endpoint', sub.endpoint);
      return { ok: false, removed: true };
    }
    return { ok: false, status, message: err?.message };
  }
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!vapidReady) return NextResponse.json({ error: 'vapid-not-configured' }, { status: 503 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad-json' }, { status: 400 }); }

  const { oldState, newState } = body || {};
  const events = pickEvents(oldState, newState);
  if (events.length === 0) return NextResponse.json({ events: [], sent: 0, removed: 0, failed: 0 });

  let sent = 0, removed = 0, failed = 0;
  for (const ev of events) {
    const subs = await loadSubs(ev);
    const payload = { title: ev.title, body: ev.body, url: ev.url, tag: ev.tag };
    const results = await Promise.all(subs.map((s) => sendOne(s, payload)));
    for (const r of results) {
      if (r.ok) sent++;
      else if (r.removed) removed++;
      else failed++;
    }
  }

  return NextResponse.json({
    events: events.map((e) => ({ kind: e.kind, tag: e.tag })),
    sent, removed, failed,
  });
}
