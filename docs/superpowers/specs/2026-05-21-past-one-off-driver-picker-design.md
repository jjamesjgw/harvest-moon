# Past One-Off Driver Picker — Design

**Date:** 2026-05-21
**Author:** Justin (jjamesjgw) + Claude
**Status:** Approved for implementation planning

## Context & Goals

Harvest Moon's Cup driver pool starts each week as `DEFAULT_DRIVERS` (the 36 full-timers). NASCAR Cup races regularly include part-time drivers — Corey Heim, Connor Zilisch, occasional Jimmie Johnson appearances, road-course ringers like Kimi Räikkönen — who must be added as one-off entries via Manage Drivers before the league can draft them.

Today, the only way to add a one-off is to type the driver's car number, name, team, and pick two livery colors from scratch. Every week. Even when it's the same recurring part-timer the admin already entered weeks earlier. The data exists — every past one-off lives in `state.weekDriversExtra` — but the UI never surfaces it.

Goal: when the admin opens the "Add One-Off Cup Driver" form, surface previously-entered drivers as a tap-to-prefill picker. Brand-new drivers still go through the full manual entry flow.

This spec is a follow-up to PR #56 (`fix/draft-duplicate-cross-week`), which corrected a validation bug that previously made re-adding past drivers impossible at all. With that fix shipped, the structural blocker is gone; this spec addresses the remaining UX gap.

## Out of Scope

- Bonus-series pools (Trucks, Xfinity, ARCA, etc.). The same retyping pain exists there but is deferred to a v1.1 PR to keep this change isolated. Confirmed with user: "Cup only for v1."
- Editing or removing entries from history. If a driver was typo'd in a past week, the chip just won't get tapped; we don't add a history-management UI.
- Search/filter input on the picker. Realistic season volume (~10–15 unique one-offs) is small enough that "show top N + expand" handles it.
- Introducing a new persistent state shape (e.g. `state.partTimeDrivers`). The user's mental model is "pick from anyone previously entered, or enter a brand-new driver" — not a curated regulars list. Existing `weekDriversExtra` is the source of truth.
- Changes to the Draft screen itself. The admin's entry point on Draft (`+ Add Cup Driver` button at `DraftScreen.jsx:338-352`) already routes to Manage Drivers; this spec improves that destination.
- API, RLS, or migration changes. The picker is pure read-side derivation from existing client state.

---

## 1. Data — `cupHistory`

### 1.1 Source

Walk `state.weekDriversExtra` (shape: `{ [weekNum: string]: Driver[] }`). For each week, each entry is a `Driver` object `{ num, name, team, primary, secondary }`.

### 1.2 Derivation rules

1. **Order by recency.** Iterate weeks in descending numeric order so the most-recently-added entry for any given car number wins the dedup.
2. **Dedup by `num`.** First occurrence kept (which is the most recent thanks to step 1). A driver's team and livery may have changed since their last appearance; we always show the latest known values.
3. **Exclude already-rostered numbers.** Drop any entry whose `num` appears in `state.drivers` for the current week. This filters:
   - Full-timers already in `DEFAULT_DRIVERS` (e.g. if a one-off in week 3 had a number that later got reused — unlikely but defensive).
   - Drivers already added as one-offs in the current week.
4. **Track "last seen" week.** Each surviving entry carries the week number where it was most recently observed, for display in the picker.

### 1.3 Shape

```js
cupHistory = [
  { num: 67, name: 'Corey Heim',     team: 'TRICON Garage', primary: '#9A2D2D', secondary: '#FDFAF0', lastSeenWeek: 7 },
  { num: 84, name: 'Jimmie Johnson', team: 'Legacy MC',     primary: '#1A4D7A', secondary: '#F7F4ED', lastSeenWeek: 4 },
  // ...
]
```

Already sorted most-recent-first by construction.

### 1.4 Placement

Computed inside `ManageDriversScreen` (the only component that uses it). Pure derivation, no `useMemo` needed for a list of ~15 items; recompute on every render is cheap. If profiling shows it matters later, wrap in `useMemo` keyed on `state.weekDriversExtra` and `drivers`.

---

## 2. UI — `AddDriverForm` extension

### 2.1 Component contract

`AddDriverForm` (in `components/screens/ManageDriversScreen.jsx`) gains one new optional prop:

```
history?: Driver[]   // ordered most-recent-first; default []
```

All existing props (`onCancel`, `onAdd`, `existingNums`, `title`) and existing behavior are preserved.

### 2.2 New section: "From past weeks"

Rendered **above** the existing `# / Driver name / Team / Livery` fields. Visible only when `history.length > 0`. Brand-new leagues and clean-slate weeks see exactly the form they see today.

**Anatomy (top to bottom):**

```
[small uppercase label]  FROM PAST WEEKS
[chip row]   [#67 Corey Heim] [#84 Jimmie Johnson] [#7 Kimi Räikkönen] ...  [+ N more]
[thin divider, italic caption]   or enter a brand-new driver
[existing # / name / team / livery fields, unchanged]
```

**Chip element:**
- Layout: existing `CarNum` primitive (size 22–24, no `onClick` form so it doesn't render a button-in-button) + driver name. Uses the same livery rendering the rest of the app already uses.
- Tap target: the entire chip is a `<button>`. On click: `setD({ num: String(driver.num), name: driver.name, team: driver.team, primary: driver.primary, secondary: driver.secondary })`. Error state cleared (`setErr(null)`).
- Visual cue when a chip has been tapped this session: not required for v1; the form fields below show what got filled, which is sufficient feedback.

**Volume control:**
- Show up to 6 chips by default.
- If `history.length > 6`, render a 7th chip styled as `+ N more` (where N = `history.length - 6`). Tapping it sets a local `expanded` state in `AddDriverForm` that reveals the remaining chips inline. No collapse-back needed for v1 — once expanded, stays expanded for the lifetime of the form.

**Divider caption:**
- A single italic line between the chip row and the manual fields: *"or enter a brand-new driver"*. Reinforces that the form below is for first-time entries; the chips above are the express lane.

### 2.3 Form submission

Unchanged. After a chip pre-fills the fields, the admin reviews (optionally edits team or livery for a sponsor change), then taps **Add** as today. `onAdd(driver)` fires with the same payload shape as a manually-typed entry. `existingNums` validation still applies — if a chip's number somehow collides with the current roster (shouldn't happen because we filter in §1.2, but defense in depth), the existing error path catches it.

### 2.4 Bonus-pool reuse

Bonus-pool forms continue to pass no `history` prop, so the new section is omitted there. No behavioral change to Trucks/Xfinity/ARCA/etc. add flows in this PR. (Follow-up PR scope.)

---

## 3. Implementation Touchpoints

Both edits land in **`components/screens/ManageDriversScreen.jsx`**. No other files change.

### 3.1 `ManageDriversScreen` component body

After the existing `currentCupNums` computation (line ~95 post-PR #56):

1. Derive `cupHistory` per §1.2.
2. Pass `history={cupHistory}` to the Cup `AddDriverForm` instance (line ~255 in current code).

### 3.2 `AddDriverForm` component

1. Add `history = []` to the destructured props.
2. Add local state `const [expanded, setExpanded] = useState(false)`.
3. Inside the returned JSX, before the existing `<div style={{ display:'flex', gap:6 }}>` (the # + Name row), conditionally render the chips section when `history.length > 0`.
4. Chip click handler: pre-fills `d` via `setD(...)` and clears `err` via `setErr(null)`.

Estimated diff: ~50 lines added, 0 removed.

---

## 4. Edge Cases & Decisions

| Case | Behavior |
|------|---------|
| `weekDriversExtra` empty (brand-new league or never used) | Picker section hidden entirely. Form is byte-identical to today. |
| All historical drivers are currently rostered | `cupHistory` empty after filter → picker section hidden. |
| History has 1–6 entries | Show all as chips; no "+ N more". |
| History has >6 entries | Show 6 + "+ N more" expansion chip. |
| Chip tapped, then admin edits one field | Edit wins. Submit uses the edited values. |
| Chip tapped, then admin taps Cancel | Form closes; no driver added. Existing behavior. |
| Same driver in history with different liveries across two past weeks | Most-recent wins (dedup keeps first occurrence in descending-week scan). |
| Driver number in history collides with a current week one-off already added | Already filtered out in §1.2; chip is not rendered. |
| Network of state synced from another league member mid-add | Existing realtime push path handles this; pre-filled local form state is unaffected (the form is local React state, not state-blob state). |

## 5. Rollback

Single-file revert of `components/screens/ManageDriversScreen.jsx`. No data shape, no migration, no API surface, no RLS.

## 6. Test Plan (manual)

- [ ] Empty history: open Add form in a fresh-season Wk 1 with no extras yet → picker section absent, manual fields identical to current behavior.
- [ ] Single-entry history: add Heim #67 in Wk 3, advance to Wk 5, open Add form → one chip visible, taps prefill the form with #67/Heim/team/livery.
- [ ] Multi-entry history: add Heim Wk 3, Zilisch Wk 4, Johnson Wk 5, advance to Wk 6, open Add → chips in order Johnson, Zilisch, Heim (most-recent first).
- [ ] Already-rostered filter: add Heim Wk 6, open the Add form again same week → Heim chip absent.
- [ ] Volume cap: simulate >6 unique one-offs across history → 6 visible + "+ N more"; tap "+ N more" reveals the rest.
- [ ] Edit after prefill: tap chip, change team to "New Team 2026", tap Add → driver added with the edited team; the chip's old team is not what was saved.
- [ ] Manual-entry path: do NOT tap a chip; type a brand-new driver → unchanged behavior.
- [ ] Validation: tap a chip, manually change the number to one already in `currentCupNums` (e.g. #24), tap Add → existing "#NN is already in this pool" error fires.
- [ ] Visual: chips don't overflow the section horizontally on a typical phone width; wrap if needed.

## 7. Open Questions

None at spec time. Implementation plan can proceed.
