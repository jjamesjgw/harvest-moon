# Manual, Ungated Bonus-Driver Picks

**Date:** 2026-06-29
**Status:** Approved design — ready for implementation plan

## Problem

On bonus weeks (e.g. an O'Reilly week configured `{ Cup: 4, OReilly: 1 }`), the
league wants to draft the bonus driver *whenever* during the snake draft, and to
enter that driver as a **car number they type**, not select from a pre-built pool.

Today two things force the bonus pick to the end of the draft:

1. The series tab **snaps back to Cup on every turn** (`DraftScreen.jsx` picker-change
   effect), so the bonus tab is never the default.
2. A bonus tab is **disabled while its pool is empty** (`SeriesTabs`, `poolEmpty`),
   and the pool only fills if the admin pre-loads drivers in Manage Drivers. If they
   skip that, the bonus tab can't be used at all.

The result feels gated behind the 4 Cup picks.

## Decisions (locked)

- **Pick model:** The bonus driver stays one of the player's snake picks (still picked
  on the clock), but the Cup-first gating is removed so any turn can be spent on it.
- **Entry:** Manual **number only** (no name, no pool). History/recaps show `#N`.
- **Uniqueness:** A bonus car number, once taken that week for that series, cannot be
  taken again — same uniqueness rule Cup picks already have.
- **Scope:** Applies to **all** bonus series (Truck, O'Reilly, High Limit). The admin
  no longer pre-populates any bonus pool.
- **Default tab:** Each turn opens on **Cup** (switchable); the bonus tab is always one
  tap away whenever the player has an allotment left.
- **Sequencing:** Two PRs (behavior change first, admin-UI cleanup second).

## Architecture

The pick record is already the source of truth downstream. Each pick stores
`{ driverNum, driverName, series, playerId, round, slot, at }`, and the snapshotted
`driverName` is what history, the board, the strip, and results entry fall back to when
a pool lookup misses. We lean on that: manual entry simply produces a pick whose
`driverName` is `"#N"`, and we stop relying on pools for bonus series.

### A. Bonus pick UI → manual number entry (`components/screens/DraftScreen.jsx`)

- When `mode === 'pick'` and `activeSeries !== 'Cup'`, render a new
  **`BonusNumberEntry`** panel in place of `DraftGrid`.
- Panel contents: a numeric input (0–999) and a **"Lock in #N"** button. Mirror the
  validation already used in `ManageDriversScreen`'s add-driver form
  (`parseInt(value, 10)`, finite, `0 ≤ n ≤ 999`).
- On confirm, validate in this order and show an inline error on failure:
  1. number is a finite integer in `0..999`;
  2. `remainingForPicker(activeSeries) > 0`;
  3. `!pickedKeys.has(pickKey(activeSeries, n))` (uniqueness for that series this week).
- On success, call the **existing** `pick()` with a synthetic driver
  `{ num: n, name: \`#${n}\` }`. No new pick path — `pick()` already appends inside the
  `setState` updater (race-safe, #44), advances the round, and flips `phase` to `done`
  when the draft completes.
- Gate the panel on `canPick` exactly like the grid: a viewer who is not on the clock
  (and not admin) sees a read-only "waiting on <picker>" state, not an active input.
- Clear the input after a successful lock-in.

### B. Remove Cup-first gating (`DraftScreen.jsx` / `SeriesTabs`)

- In `SeriesTabs`, a bonus tab is `disabled` only when `remaining <= 0`. Drop the
  `poolEmpty` branch — there is no pool to be empty.
- Keep the existing default-to-Cup behavior on picker change and the auto-advance when a
  series is maxed. Because bonus tabs are now always enabled (given allotment), the
  player can switch to the bonus tab on any turn → "select whenever."
- Remove the now-unused `bonusPools` plumbing into `SeriesTabs` (it was only used to
  compute `poolEmpty`).

### C. Remove dead bonus-pool admin UI (`components/screens/ManageDriversScreen.jsx`) — PR 2

- Delete the "Bonus Week — add eligible drivers for each bonus series" block and its
  helpers (`bonusPool`, `addBonus`, `removeBonus`, `bonusAdding` state) — nothing reads
  these pools during the draft anymore.
- Leave the `bonusDriversByWeek` shape in state and `getBonusPool` in `lib/utils.js`
  intact so **already-played** weeks that have populated pools still render in history.

### D. Verify render fallbacks (`DraftScreen.jsx` board/strip, history/recap) — PR 1

- Confirm the draft **Board**, **latest-picks strip**, and history/recap render bonus
  picks from the pick's stored `driverName` / `#${driverNum}`, not from a pool hit
  (which will now miss for new bonus picks). Fix any site that requires a pool resolve.
- `EnterResultsScreen.jsx` is already safe: it builds the drafted list from `picks` with
  a `pk.driverName || \`#${num}\`` fallback (lines ~283–286). No change needed there.

## Data flow

1. Player on the clock taps the bonus series tab → `BonusNumberEntry` shows.
2. Player types a car number, taps **Lock in #N** → validation → `pick({num, name:"#N"})`.
3. Pick lands in `draftState.picks` with `series` set; snake advances normally.
4. Board / strip / history render it as `#N` from the stored snapshot.
5. After the race, admin enters results; the bonus number appears in results entry from
   the pick record and gets its points like any other drafted driver.

## Error handling

- Out-of-range / non-numeric input → inline error, no pick recorded.
- Duplicate number for that series this week → inline "already taken" error.
- No allotment left in the active series → the tab is disabled (can't reach the panel);
  defensive re-check in the confirm handler as well.
- All validation failures are non-destructive: the player can correct and retry.

## Testing / verification

- Bonus week: on the **first** turn, switch to the bonus tab and lock in a number —
  it records without first using any Cup pick.
- Uniqueness: a second player cannot lock in a number already taken that series/week.
- Range: `1000`, `-1`, and empty input are rejected with an inline error.
- Undo removes a manually-entered bonus pick and frees its number.
- Board, latest-picks strip, and history show the bonus pick as `#N`.
- Results entry lists the manually-entered bonus number and applies its points.
- Non-bonus (pure Cup) weeks are unchanged.
- A past week that still has a populated pool renders unchanged in history.

## Out of scope

- Optional driver-name entry for bonus picks (numbers only, per decision).
- Allowing duplicate bonus numbers across players (uniqueness retained).
- Any change to Cup drafting, slot pick, or All-Star flows.

## Sequencing

- **PR 1 — `feat/manual-bonus-driver-picks`:** Sections A, B, D. User-facing behavior
  change. Rollback: revert the PR; bonus picks return to pool-grid + Cup-first gating.
- **PR 2 — `chore/remove-bonus-pool-admin`:** Section C. Cleanup of the unused admin UI,
  shipped after PR 1 is confirmed live. Rollback: revert; the admin pool form returns
  but remains unused by the draft.
