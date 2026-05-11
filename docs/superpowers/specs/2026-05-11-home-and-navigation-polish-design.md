# Home & Navigation Polish — Design

**Date:** 2026-05-11
**Author:** Justin (jjamesjgw) + Claude
**Status:** Approved for implementation planning

## Context & Goals

Harvest Moon is a NASCAR fantasy app. Three rough edges surfaced in usage:

1. **Home is a launchpad, not a status hub.** It shows the current race and league standings but skips highlights like "your roster for this race," "what happened last race," and league-wide stats. It feels generic rather than personal.
2. **Driver and player links are inconsistent.** Tapping a driver chip opens that driver's profile on some screens (Team, Recap, History, Enter Results) but not others (Draft, Standings, Schedule, Profile). Player avatars are never tappable.
3. **Draft state on the global banner is thin.** `OnTheClockBanner` says who's on the clock but not what round or pick number — non-pickers can't tell at a glance how far the draft has progressed.

Goal: a single coordinated UX polish pass that turns Home into a summary hub, makes driver/player relationships clickable everywhere, and surfaces draft progress globally. Home stays a hub — summaries that link to detail, not duplicates of detail.

## Out of Scope

- Restructuring the "More" tab (kitchen-drawer reorg deferred to a future spec)
- Live in-race data integration (no real-time positions; results still come from Wikipedia post-race)
- Admin-tools surfacing (Manage Drivers, Edit Results, Reset stay in More)
- New screens — every change reuses existing screens
- Visual redesign of existing primitives (`CarNum`, `PlayerBadge`, etc.)

---

## 1. Home Page Redesign

### 1.1 New section order (top to bottom)

```
TopBar                  (existing — unchanged)
SaveBanner              (existing — only on sync errors)
OnTheClockBanner        (existing global — enhanced per §3)
Results-due callout     (existing — admin only, conditional)

§1.2  Race hero card           (existing — unchanged)        ── current race
§1.3  Stat of the season       (NEW)                          ── tap → Drivers
§1.4  Your roster strip        (NEW)                          ── tap → Team
§1.5  Last race strip          (NEW, conditional)             ── tap → Recap
§1.6  Your standing card       (existing — unchanged)         ── tap → Standings
§1.7  Upcoming races           (existing — + tap → Schedule)
§1.8  Race quote of the week   (NEW)                          ── flavor, no link
```

### 1.2 Race hero card

No changes. The user explicitly wants this preserved as-is.

### 1.3 Stat of the season (NEW)

**Data source:** `computeAllDriverStats(state).awards` (already exists). Returns `{topScorer, mostPicked, bestSleeper}`.

**Rotation:** deterministic weekly cycle — `['topScorer','mostPicked','bestSleeper'][currentWeek % 3]`. Predictable, no surprise card. Each award appears 12 times across a 36-week season.

**Layout:** thin section label (e.g., `"Stat of the Season · Top Scorer"`), then a row containing: `CarNum` chip, driver name, headline metric (e.g., `"305 pts"`), secondary metric (e.g., `"11× drafted"`).

**Tap target:** wrapper button → `onNav('drivers', { driverNum: d.num })` opens the Drivers screen with that driver's detail view pre-opened (existing `initialNum` mechanism).

**Empty state:** if `all.awards.topScorer` is null (Wk 1 before any race finalized), the entire section hides.

### 1.4 Your roster strip (NEW)

**Data source:** `state.draftState.picks` filtered by `me.id` for the current week (or `draftHistory[currentWeek]` if the week has been finalized). Driver liveries resolved the same way Team Screen does.

**Layout:** section label `"Your Roster · Wk {NN}"`. Below: a horizontal strip with each of the player's Cup driver chips (`CarNum size=36`), plus any bonus-week picks with a small series tag inline. Right-aligned: current weekly pts (e.g., `"163 pts"`), pulled from `weeklyResults[currentWeek].pts[me.id]` if it exists, else `"—"`.

**Tap targets:**
- Each `CarNum` chip → driver profile (`onNav('drivers', { driverNum: d.num })`)
- Strip wrapper (outside the chips) → Team tab (`onNav('team')`)

**Empty state:** if `state.draftState.picks` is empty for `me.id` (pre-draft or draft incomplete), render 4 grey placeholder chips and a subtle italic caption `"Drafting…"` or `"Slot pick not yet started"` depending on phase.

### 1.5 Last race strip (NEW, conditional)

**Render condition:** `weeklyResults.find(w => w.wk === currentWeek - 1)?.finalized === true`. Hidden otherwise (avoids stale data after a bye week or before Wk 2).

**Data source:** `weeklyResults[currentWeek-1].pts` for everyone's totals; `schedule[currentWeek-1]` for track name.

**Layout:** one-line strip in a card:
- If you won the week: `"Wk 11 · Texas · You won the week (228 pts) 🏆"` — row colored copper (`T.hot`).
- Otherwise: `"Wk 11 · Texas · You: 3rd (186 pts) · Tone won the week (233)"` — neutral color.

**Tap target:** wrapper → `onNav('recap', { wk: currentWeek - 1 })`. Confirm RecapScreen accepts a wk param; if not, extend it.

**Tie edge case:** if `me.id` is among the set of players tied for highest weekly pts, render the "you won the week" copper version. (Ties are functionally rare given how pts shake out, but the copy stays correct rather than showing "you: 1st · you won".)

### 1.6 Your standing card

No changes. Already exists and links to Standings.

### 1.7 Upcoming races

Existing component. Single small change: section label gains a `LinkArrow` "All →" on the right that calls `onNav('schedule')`, matching the existing pattern used by the (now-removed) Leaderboard label and the Your-Standing card's "View" link. Individual race rows stay non-interactive — one canonical tap target per section, no nested affordances.

**Top-3 leaderboard is removed** — Your-standing card already shows rank + gap to leader, making the top-3 panel duplicative.

### 1.8 Race quote of the week (NEW)

**Data source:** new module `lib/quotes.js` exporting a constant `RACE_QUOTES = [{ text, speaker, context? }, …]`. Initial list: ~25 hand-picked entries mixing real NASCAR/broadcast history and movie classics.

**Selection:** `RACE_QUOTES[currentWeek % RACE_QUOTES.length]`. Deterministic — everyone in the league sees the same quote during the same week. Changes when `currentWeek` advances.

**Layout:** bottom of page, after Upcoming. Italic blockquote (`fontFamily: FI`), large opening quote mark, body text, then `— Speaker Name` on the next line and an optional muted context line (year/race/role) below that.

**No tap target.** Flavor only.

**Sample entries** (final list curated by Justin):
- `"Boogity boogity boogity, let's go racin' boys!"` — Darrell Waltrip
- `"Second place is just the first loser."` — Dale Earnhardt Sr.
- `"Rubbin', son, is racin'."` — Cole Trickle, *Days of Thunder*
- `"If you ain't first, you're last."` — Ricky Bobby, *Talladega Nights*
- `"I've been to two World Fairs and a goat rodeo. I never seen nothin' like this."` — A.J. Foyt
- `"This ain't checkers, this is chess."` — common race-strategy parlance

---

## 2. Cross-linking

### 2.1 Wire missing `CarNum` `onClick`

Add `onClick={series === 'Cup' ? () => onNav('drivers', { driverNum: d.num }) : undefined}` to every `CarNum` render site outside the Drivers tab itself. Specific call sites (line numbers from current `main` HEAD):

| File | Line(s) | Context |
|---|---|---|
| `components/screens/DraftScreen.jsx` | 618, 791, 897 | driver tiles (available, taken, etc.) |
| `components/screens/ScheduleScreen.jsx` | 276 | bonus-driver pool chips |
| `components/screens/ProfileScreen.jsx` | 220 | favorite-driver chip |

`StandingsScreen` has no `CarNum` references — only `PlayerBadge` (handled in §2.2). Already wired (no change): `TeamScreen`, `RecapScreen`, `HistoryScreen`, `EnterResultsScreen`. The two "internal" callers (`DriversScreen`, `ManageDriversScreen`) intentionally do not navigate — they're inside the driver-management UX.

### 2.2 `PlayerBadge` becomes tappable

Update `components/ui/primitives.jsx::PlayerBadge` to accept an optional `onClick` prop. When provided, renders as a `<button>` with the same visual treatment; when omitted, renders the existing `<div>`. Fully backwards-compatible.

Wire `onClick={() => onNav('team', { playerId: p.id })}` at the relevant call sites:

- `StandingsScreen` — every player row (lines 142, 265 in current file)
- `DraftScreen` — slot assignments + pick rows + draft order display
- `RecapScreen` — player cards
- `MembersScreen` — player rows (lines 31, 69)

Do NOT wire on:
- `HomeScreen` "Your standing" card (it's always you)
- `TeamScreen` header chip (already on Team)
- `JustPickedToast` / `YourTurnToast` / `OnTheClockBanner` (these have their own primary tap targets)
- Profile screen's own avatar

### 2.3 `TeamScreen` accepts `viewingPlayerId`

Today `TeamScreen` always renders the logged-in player's team. Add an optional `viewingPlayerId` prop:

- When `viewingPlayerId` is set and differs from `me.id`, render that player's picks and history instead of `me`'s.
- TopBar title changes to `"{playerName}'s Team"`; subtitle still shows current week. Add a small "← My Team" `LinkArrow` in the header that clears the viewing prop.
- Read-only mode — no admin/edit actions should expose other players' data for edit. Verify TeamScreen has no edit affordances today (it appears to be read-only already; confirm during implementation).

Routing wiring in `HarvestMoon.jsx`:
- Add a stash field `pendingViewingPlayerId` (with `setPendingViewingPlayerId`) alongside the existing `pendingDriverNum` pattern (line 111 in current `main`).
- `onNav('team', { playerId })` sets the stash; TeamScreen receives it as a `viewingPlayerId` prop and consumes via an `onConsumeViewingPlayer` callback once mounted — mirroring how `DriversScreen` handles `initialNum` / `onConsumeInitial` (line 372).
- When the user explicitly taps the Team bottom-tab button (`TabBar` "Team" item), clear the stash so it always returns to "your team." This is the escape hatch.

---

## 3. Draft Progress on Banners

### 3.1 `OnTheClockBanner` gains a right-aligned progress line

Today the banner has two text lines on the left ("Draft in progress" / "{pickerName} is on the clock") and a right-aligned "View →" arrow. The progress info goes **right-aligned, above the View → arrow**, as a small muted line.

| Phase | Right-aligned line |
|---|---|
| `slot-pick` | `Slot pick · {slotPickIdx+1} of {players.length}` |
| `snake` | `Round {currentRound} · Pick {picks.length+1} of {totalPicks}` |
| `ready` / `done` | banner doesn't render (existing gate handles this) |

Data sources, all from `state.draftState`:
- `slotPickIdx`, `players.length` for slot-pick total
- `currentRound` for round
- `picks.length` for current pick number
- `cfg.totalPicks * players.length` for the denominator (use `getWeekConfig(state, currentWeek)`)

Styling: same font tier as the existing "Draft in progress" label (`FL`, 9px, letter-spacing 0.22em, uppercase), colored `rgba(247,244,237,0.55)` so it reads as supporting info rather than headline. Stays on the dark banner background.

### 3.2 `YourTurnToast` gets the same line

Current copy: "Pick your draft slot →" or "Make your driver pick →". Add the progress line below it using the same data sources. Same right-aligned layout.

---

## 4. Files to Create / Modify

**New:**
- `lib/quotes.js` — `RACE_QUOTES` constant with curated quote list

**Modify:**
- `components/screens/HomeScreen.jsx` — restructure per §1 (remove top-3, add stat-of-season, roster strip, last-race strip, quote-of-week, wrap Upcoming in tap target)
- `components/screens/DraftScreen.jsx` — wire `CarNum` onClick (§2.1), wire `PlayerBadge` onClick (§2.2)
- `components/screens/StandingsScreen.jsx` — wire `PlayerBadge` onClick (no `CarNum` here)
- `components/screens/ScheduleScreen.jsx` — wire `CarNum` onClick on bonus-pool chips
- `components/screens/ProfileScreen.jsx` — wire `CarNum` onClick on fav-driver chip
- `components/screens/RecapScreen.jsx` — wire `PlayerBadge` onClick
- `components/screens/MembersScreen.jsx` — wire `PlayerBadge` onClick (if applicable)
- `components/screens/TeamScreen.jsx` — accept `viewingPlayerId` prop (§2.3)
- `components/ui/primitives.jsx` — `PlayerBadge` accepts `onClick`; enhance `OnTheClockBanner` and `YourTurnToast` per §3
- `components/HarvestMoon.jsx` — add `viewingPlayerId` stash + routing logic; clear stash on explicit Team tab tap

---

## 5. Key Design Decisions (with rationale)

- **Top-3 leaderboard removed** because Your-standing already shows rank + gap to leader. Two views of the same information competed for attention. Standings tab remains one tap away.
- **Stat-of-season rotates by `week % 3`** rather than randomized so the same headline shows for the whole league all week. Predictable beats "fun surprise" for a shared experience.
- **Last race strip hidden when previous week isn't finalized** rather than showing an "—" or stale data, because dead UI is worse than absent UI on a hub page.
- **Quote section is bottom-of-page** because it's flavor, not function. Bottom-of-page rewards the scroll without competing with informational sections above.
- **Quote rotation is deterministic and not tied to track context** for simplicity. Track-themed quotes (Daytona → Earnhardt, etc.) are a future enhancement, not blocking.
- **`PlayerBadge.onClick` is opt-in** rather than always-on so existing decorative uses (Banner header avatars, toasts) don't accidentally become navigation hazards.
- **TeamScreen "viewing as" is read-only** because admin actions on someone else's team would be a footgun and there's no user-facing reason to allow it.
- **Team bottom-tab button clears the viewing stash** so a confused user always has a single-tap escape hatch back to their own team — no fancy modal stack to debug.
- **Banner progress info goes right-aligned** rather than as a third line on the left, matching dashboard conventions: identity on the left, status/metrics on the right.

## 6. Testing Notes

Manual QA flow (no automated tests today in this repo):

1. **Home page** — visit Home at Wk 1 (no prior week → last-race strip hidden), Wk 12 (with finalized Wk 11), and at currentWeek > 36 (off-season; verify hero fallback still works).
2. **Draft state** — start a fresh draft as one player, switch to another player's session, verify banner shows round/pick info correctly during slot-pick and snake phases.
3. **Cross-linking** — tap every driver chip on every screen; expect each to open the driver's detail. Tap every player avatar on every screen; expect each to switch TeamScreen to that player.
4. **TeamScreen viewing** — view a teammate's roster, scroll through past weeks, hit the Team bottom-tab button, confirm it returns to your own team.
5. **Quote rotation** — bump `currentWeek` through several values and verify the quote rotates deterministically.

## 7. Future Work (intentionally out of this spec)

- Restructuring the "More" tab (split admin from reference)
- Track-themed quote selection (Daytona → Earnhardt, Watkins Glen → Foyt)
- Live in-race data (real-time positions, projected pts)
- Driver profile shows historical relationship with each player ("Tone has drafted Bell 4 times, total 187 pts")
