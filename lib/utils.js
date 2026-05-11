import { ROUNDS_PER_WEEK, ADMIN_ID, BONUS_SERIES_IDS } from './constants';
import { DEFAULT_DRIVERS, DEFAULT_SCHEDULE, DEFAULT_WEEK_CONFIG } from './data';

// Pick → driver definition resolver. Cup picks resolve from DEFAULT_DRIVERS
// + this week's one-off Cup adds (state.weekDriversExtra[wk]). Bonus picks
// come from state.bonusDriversByWeek[wk][series]. If a driver has been
// removed from the pool after the fact (admin-edited a bonus list, etc.),
// we synthesize a stub from the pick's own `driverName` snapshot so old
// rosters keep rendering instead of silently dropping picks.
//
// This was duplicated 4× across Team/Recap/History/EnterResults — moved
// here so changes to the resolution rules only happen in one place.
export function resolveDriverByPick(state, wk, pk) {
  const series = pk.series || 'Cup';
  if (series === 'Cup') {
    const wkExtras = (state?.weekDriversExtra || {})[wk] || [];
    const cup = [...DEFAULT_DRIVERS, ...wkExtras];
    return cup.find(d => d.num === pk.driverNum) || stubDriverFromPick(pk);
  }
  const pool = state?.bonusDriversByWeek?.[wk]?.[series] || [];
  return pool.find(d => d.num === pk.driverNum) || stubDriverFromPick(pk);
}
export function stubDriverFromPick(pk) {
  return {
    num: pk.driverNum,
    name: pk.driverName || `#${pk.driverNum}`,
    primary: '#7A7268', secondary: '#3D3934',
    team: '—',
  };
}

export function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Computes the active draft turn: which player is on the clock and what kind
// of pick is owed (slot or snake). Returns null when no draft is active.
// Pure: depends only on state shape, so the /api/notify route can reuse it.
export function detectActiveTurn(state) {
  if (!state) return null;
  const ds = state.draftState;
  if (!ds) return null;
  if (ds.phase === 'slot-pick') {
    const order = buildSlotPickOrder(state.players, state.weeklyResults, state.currentWeek - 1);
    const picker = order[ds.slotPickIdx];
    if (picker) return { kind: 'slot', playerId: picker.id, name: picker.name };
  }
  if (ds.phase === 'snake') {
    const cfg = getWeekConfig(state, state.currentWeek);
    const order = buildSnakeOrder(state.players, ds.slotAssign, cfg.totalPicks);
    const onClock = order[ds.picks.length];
    if (onClock?.playerId) {
      const player = state.players.find(p => p.id === onClock.playerId);
      if (player) return { kind: 'snake', round: onClock.round, playerId: player.id, name: player.name };
    }
  }
  return null;
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

// ── BONUS / WEEK-CONFIG HELPERS ────────────────────────────────────
// The week's config defines how many drivers each player gets per series.
// Default is Cup × ROUNDS_PER_WEEK (no bonuses). Returned shape:
//   { allotments: {Cup: 4, [otherSeries]: 1, ...}, totalPicks: number,
//     bonusSeries: ['Truck', 'OReilly', ...] }
export function getWeekConfig(state, wk) {
  const stateConfig = state?.weekConfig?.[wk];
  const defaultConfig = DEFAULT_WEEK_CONFIG[wk];
  const config = stateConfig || defaultConfig || { allotments: { Cup: ROUNDS_PER_WEEK } };
  const allotments = config.allotments || { Cup: ROUNDS_PER_WEEK };
  const totalPicks = Object.values(allotments).reduce((sum, n) => sum + (n || 0), 0);
  const bonusSeries = Object.keys(allotments).filter(s => s !== 'Cup' && BONUS_SERIES_IDS.includes(s));
  return { allotments, totalPicks, bonusSeries };
}

// Returns the bonus driver pool for a given week + series, or [] if empty.
// Pools live in `state.bonusDriversByWeek[wk][series]` and are populated by
// the admin via Manage Drivers before the draft.
export function getBonusPool(state, wk, series) {
  return state?.bonusDriversByWeek?.[wk]?.[series] || [];
}

// Counts how many picks a given player has used FROM a given series in the
// current week's draft. Used to enforce per-series allotment limits and to
// drive the "Cup 2/4" series-tab counters in the draft UI.
export function countPicksBySeries(picks, playerId, series) {
  return (picks || []).filter(p => p.playerId === playerId && (p.series || 'Cup') === series).length;
}

// Returns the list of series the given player can still pick from — i.e.
// series where they haven't yet used their full allotment for the week.
export function availableSeriesForPlayer(state, wk, playerId) {
  const { allotments } = getWeekConfig(state, wk);
  const picks = state?.draftState?.picks || [];
  return Object.entries(allotments)
    .filter(([series, max]) => countPicksBySeries(picks, playerId, series) < max)
    .map(([series]) => series);
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

// Per-player roster history — Cup picks only. Bonus picks intentionally
// excluded because they come from one-week-only pools and don't represent
// a draftable trend ("Justin's most-drafted driver" wouldn't be meaningful
// if a single Truck pick at Texas counted the same as 8 Cup Larson picks).
// Walks every saved draft + result, attributes each driver's race points back
// to the player who drafted them that week, then aggregates by driver number.
// Returns:
//   { totalPicks, weeksPlayed, byDriver: [{ driverNum, name, picks, totalPts,
//                                          avgPts, bestFinish, lastWk }] }
// `bestFinish` is the highest single-race score that driver delivered for
// this player. driverPoints lookups try the new "Cup:NUM" key first, then
// fall back to the legacy flat-num key for pre-bonus historical weeks.
export function computePlayerDriverStats(playerId, draftHistory, weeklyResults, drivers) {
  const driverByNum = new Map(drivers.map(d => [d.num, d]));
  const agg = new Map();
  let totalPicks = 0;

  draftHistory.forEach(h => {
    const myCupPicks = h.picks.filter(p => p.playerId === playerId && (p.series || 'Cup') === 'Cup');
    const result = weeklyResults.find(w => w.wk === h.wk);
    myCupPicks.forEach(pk => {
      totalPicks++;
      const num = pk.driverNum;
      const dp = result?.driverPoints || {};
      const pts = dp[`Cup:${num}`] ?? dp[num] ?? 0;
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

// League-wide rollup of every Cup driver who's ever been drafted. This is
// the data feed for the Drivers screen. Walks every draftHistory week +
// matching weeklyResult, attributes the driver's race points back to whoever
// drafted them, then aggregates per-driver. Bonus picks are intentionally
// excluded — bonus drivers come from one-off pools and don't represent a
// season-long Cup trend.
//
// Returns { drivers, awards } where drivers is sorted by totalPts desc and
// awards is { topScorer, mostPicked, bestSleeper, biggestBust } — the
// banter-driving headline stats.
//
// Per-driver record shape:
//   { num, name, team, primary, secondary,
//     totalPicks, totalPts, avgPts,
//     bestWeek: { wk, pts, ownerName } | null,
//     worstWeek: { wk, pts, ownerName } | null,
//     byPlayer: [{ playerId, playerName, picks, totalPts, avgPts, bestPts }],
//     weeks: [{ wk, track, ownerName, ownerColor, pts }] (chronological) }
export function computeAllDriverStats(state) {
  const { draftHistory = [], weeklyResults = [], players = [], drivers = [], schedule = [] } = state;
  const driverMeta = new Map(drivers.map(d => [d.num, d]));
  const playerMeta = new Map(players.map(p => [p.id, p]));
  const trackByWk = new Map(schedule.map(s => [s.wk, s.track]));

  // num → aggregate record
  const agg = new Map();

  draftHistory.forEach(h => {
    const wkResult = weeklyResults.find(w => w.wk === h.wk);
    const dp = wkResult?.driverPoints || {};
    h.picks.forEach(pk => {
      // Skip bonus picks — Cup-only for league-wide trend.
      if ((pk.series || 'Cup') !== 'Cup') return;
      const num = pk.driverNum;
      // Lookup pts: try new "Cup:NUM" key, fall back to legacy flat-num for
      // pre-bonus weeks.
      const pts = dp[`Cup:${num}`] ?? dp[num] ?? 0;
      const owner = playerMeta.get(pk.playerId);
      const meta = driverMeta.get(num);

      let rec = agg.get(num);
      if (!rec) {
        rec = {
          num,
          name: meta?.name || pk.driverName || `#${num}`,
          team: meta?.team || '—',
          primary: meta?.primary || '#7A7268',
          secondary: meta?.secondary || '#3D3934',
          totalPicks: 0, totalPts: 0,
          bestWeek: null, worstWeek: null,
          _byPlayerMap: new Map(),
          weeks: [],
        };
        agg.set(num, rec);
      }
      rec.totalPicks += 1;
      rec.totalPts += pts;
      if (!rec.bestWeek || pts > rec.bestWeek.pts) {
        rec.bestWeek = { wk: h.wk, pts, ownerName: owner?.name || '?' };
      }
      if (!rec.worstWeek || pts < rec.worstWeek.pts) {
        rec.worstWeek = { wk: h.wk, pts, ownerName: owner?.name || '?' };
      }
      rec.weeks.push({
        wk: h.wk,
        track: trackByWk.get(h.wk) || h.track || '?',
        ownerName: owner?.name || '?',
        ownerColor: owner?.color || '#7A7268',
        ownerId: owner?.id,
        pts,
      });
      if (owner) {
        const cur = rec._byPlayerMap.get(owner.id) || {
          playerId: owner.id, playerName: owner.name, color: owner.color,
          picks: 0, totalPts: 0, bestPts: 0,
        };
        cur.picks += 1;
        cur.totalPts += pts;
        if (pts > cur.bestPts) cur.bestPts = pts;
        rec._byPlayerMap.set(owner.id, cur);
      }
    });
  });

  // Finalize per-record: compute averages, sort sub-arrays, drop the Map scratch field.
  const result = [];
  for (const rec of agg.values()) {
    const avgPts = rec.totalPicks ? Math.round(rec.totalPts / rec.totalPicks) : 0;
    const byPlayer = [...rec._byPlayerMap.values()]
      .map(b => ({ ...b, avgPts: b.picks ? Math.round(b.totalPts / b.picks) : 0 }))
      .sort((a, b) => b.totalPts - a.totalPts);
    const weeks = [...rec.weeks].sort((a, b) => a.wk - b.wk);
    delete rec._byPlayerMap;
    result.push({ ...rec, avgPts, byPlayer, weeks });
  }
  result.sort((a, b) => b.totalPts - a.totalPts);

  // Awards — single-line headline picks for the top of the leaderboard.
  // - topScorer: most cumulative points
  // - mostPicked: most times drafted
  // - bestSleeper: highest avg/draft among drivers picked ≤2 times (low frequency, high return)
  // - biggestBust: lowest avg/draft among drivers picked ≥4 times (high frequency, low return)
  const topScorer = result[0] || null;
  const mostPicked = [...result].sort((a, b) => b.totalPicks - a.totalPicks)[0] || null;
  const sleepers = result.filter(r => r.totalPicks <= 2 && r.totalPicks > 0);
  const bestSleeper = sleepers.length
    ? [...sleepers].sort((a, b) => b.avgPts - a.avgPts)[0]
    : null;
  const heavies = result.filter(r => r.totalPicks >= 4);
  const biggestBust = heavies.length
    ? [...heavies].sort((a, b) => a.avgPts - b.avgPts)[0]
    : null;

  return { drivers: result, awards: { topScorer, mostPicked, bestSleeper, biggestBust } };
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

// Resolve a single pick (Cup or bonus) to its full driver definition.
// Cup picks resolve from DEFAULT_DRIVERS + the week's one-off Cup adds;
// bonus picks resolve from state.bonusDriversByWeek[wk][series]. Falls
// back to a stub driver synthesized from pick.driverName so historical
// rosters always render something rather than silently dropping picks
// when the admin later edits the bonus pool.
//
// Used by Team, Recap, History and the race-detail screen — pulled out
// of those screens so the resolution logic only lives in one place.
export function resolvePickDriver(state, wk, pk) {
  const series = pk.series || 'Cup';
  if (series === 'Cup') {
    const wkExtras = (state.weekDriversExtra || {})[wk] || [];
    const cup = [...DEFAULT_DRIVERS, ...wkExtras];
    return cup.find(d => d.num === pk.driverNum) || stubDriver(pk);
  }
  const pool = state.bonusDriversByWeek?.[wk]?.[series] || [];
  return pool.find(d => d.num === pk.driverNum) || stubDriver(pk);
}
export function stubDriver(pk) {
  return {
    num: pk.driverNum,
    name: pk.driverName || `#${pk.driverNum}`,
    primary: '#7A7268', secondary: '#3D3934',
    team: '—',
  };
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

// Returns the America/New_York offset from UTC, in minutes, for a given
// calendar date. Handles DST automatically — March-November is EDT (240 min),
// rest is EST (300 min). Uses Intl.DateTimeFormat to ask the runtime what
// wall-clock time NY shows at UTC noon that day, then derives the offset.
//
// We probe at UTC 12:00 to stay well clear of the 2 AM DST transition (which
// is at 02:00 local on the 2nd Sunday of March / 1st Sunday of November).
// At UTC noon, NY shows 07:00 (EST) or 08:00 (EDT) — never ambiguous.
function nyOffsetMinutes(year, month, day) {
  const probe = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', hour12: false,
  }).formatToParts(probe);
  const nyHour = parseInt(parts.find(p => p.type === 'hour')?.value || '7', 10);
  // NY hour = UTC hour − offset_hours, so offset_hours = 12 − nyHour.
  return (12 - nyHour) * 60;
}

// Parses 'Apr 26' + '3:00 PM ET' (year defaults to current year) into a Date,
// or null if either piece is missing/unparseable. The timezone offset is
// computed per-date so the racing season's DST transitions are honored.
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
  // Compute the correct UTC offset for THIS specific date (handles EDT vs EST
  // correctly across DST transitions). Then shift the wall-clock time forward
  // by that many minutes to produce the equivalent UTC instant.
  const offsetMin = nyOffsetMinutes(year, month, day);
  return new Date(Date.UTC(year, month, day, hour, minute, 0) + offsetMin * 60 * 1000);
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
