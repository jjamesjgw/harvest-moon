import { ROUNDS_PER_WEEK, ADMIN_ID } from './constants';
import { DEFAULT_DRIVERS, DEFAULT_SCHEDULE } from './data';

// ─── DETERMINISTIC SEEDED RNG (for stable driver odds/hints per week) ───
// Kept because makeDriverWeekData is referenced by TeamScreen even though
// the odds it produces are no longer rendered.
export function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
}

export function makeDriverWeekData(drivers, seed) {
  const rnd = mulberry32(seed);
  return drivers.map(d => {
    const skill = rnd();
    const recent3 = [1, 2, 3].map(() => Math.max(1, Math.round((1 - skill) * 30 + rnd() * 8)));
    const trackAvg = (recent3.reduce((a, b) => a + b, 0) / 3 + (rnd() - 0.5) * 4).toFixed(1);
    const buckets = [+280, +350, +450, +650, +900, +1400, +2200, +4000, +6000, +10000];
    const vegasOdds = buckets[Math.min(buckets.length - 1, Math.floor((1 - skill) * buckets.length + rnd() * 2))];
    return { ...d, recent3, trackAvg, vegasOdds, skill };
  });
}

export function trackHint(driver, trackType) {
  const aff = { 'Superspeedway': 0.3, 'Intermediate': 0.5, 'Short Oval': 0.6, 'Road Course': 0.4, 'Street': 0.45 }[trackType] || 0.5;
  const score = driver.skill * 0.7 + aff * 0.3;
  if (score > 0.75) return { tag: 'ELITE HERE', tone: 'hot' };
  if (score > 0.6)  return { tag: 'STRONG',     tone: 'good' };
  if (score > 0.4)  return { tag: 'AVG',        tone: 'mid' };
  return { tag: 'RISKY', tone: 'cold' };
}

export function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Builds the canonical snake-draft pick order for a given slot assignment.
// Rounds alternate direction (1→N, N→1, 1→N, …).
export function buildSnakeOrder(players, slotAssign, rounds) {
  const slotToPlayerId = {};
  Object.entries(slotAssign || {}).forEach(([pid, slot]) => { slotToPlayerId[slot] = pid; });
  const out = [];
  for (let r = 0; r < rounds; r++) {
    const slots = r % 2 === 0
      ? Array.from({ length: players.length }, (_, i) => i + 1)
      : Array.from({ length: players.length }, (_, i) => players.length - i);
    slots.forEach(s => out.push({ round: r + 1, slot: s, playerId: slotToPlayerId[s] }));
  }
  return out;
}

// Per-player rollup through a given week. Returns each player extended with
// { seasonPts, weeklyPts, wins, avgPts }.
export function computeStandings(players, weeklyResults, throughWeek) {
  return players.map(p => {
    const mine = weeklyResults.filter(w => w.wk <= throughWeek);
    const weeklyPts = mine.map(w => w.pts[p.id] || 0);
    const seasonPts = weeklyPts.reduce((a, b) => a + b, 0);
    const avgPts = weeklyPts.length ? Math.round(seasonPts / weeklyPts.length) : 0;
    let wins = 0;
    mine.forEach(w => {
      const vals = Object.values(w.pts);
      if (vals.length && (w.pts[p.id] || 0) === Math.max(...vals)) wins++;
    });
    return { ...p, seasonPts, weeklyPts, wins, avgPts };
  });
}

// Fresh-state factory used on first install.
export function makeFreshState(players) {
  return {
    players,
    adminId: ADMIN_ID,
    drivers: DEFAULT_DRIVERS,
    schedule: DEFAULT_SCHEDULE,
    weekDriversExtra: {}, // { [wk]: [Driver, ...] } — one-off drivers added per week
    currentWeek: 1,
    weeklyResults: [],
    draftHistory: [],
    draftState: {
      phase: 'slot-pick',
      slotPickIdx: 0,
      slotAssign: {},
      currentRound: 1,
      picks: [],
    },
    meId: players[0].id,
  };
}
