// Pure-JS scoring helpers shared by the client (EnterResultsScreen) and the
// server route (api/ingest-results). The route is a Node serverless function
// and the screen is 'use client', so this module must avoid any imports that
// pull in either runtime.

export const ptsKey = (series, num) => `${series || 'Cup'}:${num}`;

// Read a driver's points for the given series. Falls back to the legacy
// flat-num key for Cup so pre-bonus-rollout weeks still resolve.
export const lookupPts = (driverPoints, series, num) => {
  const k = ptsKey(series, num);
  if (Object.prototype.hasOwnProperty.call(driverPoints, k)) return driverPoints[k];
  if ((series || 'Cup') === 'Cup' && Object.prototype.hasOwnProperty.call(driverPoints, num)) {
    return driverPoints[num];
  }
  return undefined;
};

// Per-player weekly rollup. Sums each pick's points, adds bonuses, and lets
// an override replace the computed total. Bonus picks count identically to
// Cup picks — they just live under different driverPoints keys.
export function rollupPts(players, picks, driverPoints = {}, bonuses = {}, overrides = {}) {
  const pts = {};
  for (const p of players) {
    const myPicks = picks.filter(pk => pk.playerId === p.id);
    const base = myPicks.reduce((s, pk) => s + (lookupPts(driverPoints, pk.series, pk.driverNum) || 0), 0);
    const o = overrides[p.id];
    pts[p.id] = o != null ? o : (base + (bonuses[p.id] || 0));
  }
  return pts;
}
