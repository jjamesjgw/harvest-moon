// Universal helpers used by both the client (useLeague) and the server
// (/api/league). No `'use client'` directive — must stay importable from
// route handlers.

// Detects state that is structurally indistinguishable from a fresh init —
// no completed weeks, no draft history, no in-progress picks, no player
// customizations. After any real use of the league at least one of these
// will be non-empty. Used as a tripwire to refuse the auto-init wipe bug,
// both at the call site (client) and at the DB boundary (server).
//
// Kept loose enough that legitimate `resetSeason` writes still go through,
// because resetSeason spreads `...s` and therefore preserves any
// player.favDriverNum customizations from Profile edits.
export function isFreshShaped(s) {
  if (!s || typeof s !== 'object') return false;
  if (Array.isArray(s.weeklyResults) && s.weeklyResults.length > 0) return false;
  if (Array.isArray(s.draftHistory) && s.draftHistory.length > 0) return false;
  if (Array.isArray(s.draftState?.picks) && s.draftState.picks.length > 0) return false;
  const players = Array.isArray(s.players) ? s.players : [];
  if (players.some(p => p && p.favDriverNum)) return false;
  return true;
}
