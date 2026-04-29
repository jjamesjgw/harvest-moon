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

// Per-player roster history → "who has this player drafted, and how have those
// drivers performed for them?" Walks every saved draft + result, attributes
// each driver's race points back to the player who drafted them that week,
// then aggregates by driver number. Returns:
//   { totalPicks, weeksPlayed, byDriver: [{ driverNum, name, picks, totalPts,
//                                          avgPts, bestFinish, lastWk }] }
// `bestFinish` is the highest single-race score that driver delivered for
// this player. Sort key is caller's choice (most-drafted vs best-avg).
export function computePlayerDriverStats(playerId, draftHistory, weeklyResults, drivers) {
  const driverByNum = new Map(drivers.map(d => [d.num, d]));
  const agg = new Map(); // driverNum → running totals
  let totalPicks = 0;

  draftHistory.forEach(h => {
    const myPicks = h.picks.filter(p => p.playerId === playerId);
    const result = weeklyResults.find(w => w.wk === h.wk);
    myPicks.forEach(pk => {
      totalPicks++;
      const num = pk.driverNum;
      // Result rows store driverPoints as a flat object keyed by driver num.
      // If we don't have one (older states), fall back to 0 — the row still
      // counts as a pick, just without point attribution.
      const pts = result?.driverPoints?.[num] ?? 0;
      const cur = agg.get(num) || {
        driverNum: num,
        name: driverByNum.get(num)?.name || `#${num}`,
        picks: 0, totalPts: 0, bestFinish: 0, lastWk: 0,
      };
      cur.picks += 1;
      cur.totalPts += pts;
      if (pts > cur.bestFinish) cur.bestFinish = pts;
      if (h.wk > cur.lastWk) cur.lastWk = h.wk;
      agg.set(num, cur);
    });
  });

  const byDriver = [...agg.values()].map(r => ({
    ...r,
    avgPts: r.picks ? Math.round(r.totalPts / r.picks) : 0,
  }));

  return {
    totalPicks,
    weeksPlayed: draftHistory.filter(h => h.picks.some(p => p.playerId === playerId)).length,
    byDriver,
  };
}

// Slot-pick order for an upcoming week — lowest season points first.
// Tiebreakers (in order):
//   1. Lower season points → picks earlier (the worse player goes first)
//   2. Lower most-recent week's points → picks earlier (still struggling)
//   3. Alphabetical by name (stable, deterministic — only kicks in on Week 1)
// Without these, JavaScript's .sort() can flip equal-points players between
// renders, which made Week 1 ordering unstable.
export function buildSlotPickOrder(players, weeklyResults, throughWeek) {
  const standings = computeStandings(players, weeklyResults, throughWeek);
  const lastWeek = weeklyResults.length
    ? weeklyResults.reduce((m, w) => Math.max(m, w.wk), 0)
    : 0;
  const lastResult = lastWeek ? weeklyResults.find(w => w.wk === lastWeek) : null;
  return [...standings].sort((a, b) => {
    if (a.seasonPts !== b.seasonPts) return a.seasonPts - b.seasonPts;
    if (lastResult) {
      const ap = lastResult.pts[a.id] || 0;
      const bp = lastResult.pts[b.id] || 0;
      if (ap !== bp) return ap - bp;
    }
    return a.name.localeCompare(b.name);
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

// ── RACE TIME PARSING ──────────────────────────────────────────────
// The schedule stores `date` as 'Apr 26' and `time` as '3:00 PM ET'.
// We assemble those into a real Date at display time so the user sees
// a live countdown. Year is taken from the surrounding context (the season
// year of the schedule), since the strings themselves don't include it.
const MONTHS = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };

// Parses 'Apr 26' + '3:00 PM ET' (year defaults to current year) into a Date,
// or null if either piece is missing/unparseable. Times are assumed Eastern;
// we approximate as UTC-5 since fantasy-league users don't need DST precision.
export function parseRaceTime(date, time, year = new Date().getFullYear()) {
  if (!date || !time) return null;
  const [monthStr, dayStr] = date.trim().split(/\s+/);
  const month = MONTHS[monthStr];
  const day = parseInt(dayStr, 10);
  if (month == null || !Number.isFinite(day)) return null;
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  // Eastern Time → UTC. Use -5 for ET as a safe constant; a one-hour DST
  // drift won't change "in 2d 4h" strings meaningfully for end users.
  return new Date(Date.UTC(year, month, day, hour + 5, minute, 0));
}

// Returns a human-friendly countdown string, plus a status flag.
//   { status: 'upcoming' | 'live' | 'final', label: '2d 4h' | 'Live now' | 'Final' }
// `now` is injectable so tests + components that re-render on a tick can pass
// a current time without depending on Date.now() inside the function.
export function raceCountdown(date, time, now = new Date(), year) {
  const start = parseRaceTime(date, time, year);
  if (!start) return null;
  const diffMs = start.getTime() - now.getTime();
  // Treat the race as "live" for ~4 hours after green flag, then "final".
  if (diffMs <= 0) {
    if (diffMs > -4 * 3600 * 1000) return { status: 'live',  label: 'Live now' };
    return { status: 'final', label: 'Final' };
  }
  const totalMin = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  let label;
  if (days >= 1) label = `${days}d ${hours}h`;
  else if (hours >= 1) label = `${hours}h ${mins}m`;
  else label = `${mins}m`;
  return { status: 'upcoming', label };
}
