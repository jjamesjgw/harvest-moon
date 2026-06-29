# Manual, Ungated Bonus-Driver Picks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players draft a bonus-series driver (e.g. O'Reilly) on any of their snake turns by typing the car number, instead of being gated behind the 4 Cup picks and an admin-curated pool.

**Architecture:** The pick record (`{driverNum, driverName, series, ...}`) is already the source of truth; every downstream view resolves a bonus pick through `resolvePickDriver` → `stubDriver`, which falls back to `#N` when no pool entry exists. So we (1) swap the bonus pool grid for a number-entry panel that routes through the existing `pick()` path with a synthetic `{num, name:"#N"}` driver, (2) drop the empty-pool tab gating, and (3) later delete the now-dead admin pool UI.

**Tech Stack:** Next.js App Router, React 18, plain JS. **No test framework exists in this repo** (no jest/vitest, zero test files), so verification is **manual via `npm run dev`** — consistent with the codebase's established convention. Introducing a test harness is intentionally out of scope (separate concern).

**Verification context:** Today is 2026-06-29; **Wk 19 (Sonoma)** is the current week and is configured `{ Cup: 4, OReilly: 1 }` (`lib/data.js:122-125`). Use it as the live bonus week for all manual checks. The on-the-clock player (or admin, who can pick for anyone) drives the draft.

---

## File Structure

**PR 1 — `feat/manual-bonus-driver-picks`** (behavior change):
- Modify: `components/screens/DraftScreen.jsx`
  - Add `tryPickBonus` handler inside `DraftScreen`.
  - Add `BonusNumberEntry` presentational component.
  - Swap `DraftGrid` → `BonusNumberEntry` when the active series isn't Cup.
  - Drop empty-pool gating in `SeriesTabs` and its `bonusPools` prop.
  - Suppress the redundant `#N` name in `LatestPicksStrip`.

**PR 2 — `chore/remove-bonus-pool-admin`** (cleanup, ships after PR 1 is confirmed live):
- Modify: `components/screens/ManageDriversScreen.jsx`
  - Delete the bonus-pool UI block + `addBonus`/`removeBonus`/`bonusPool` helpers + `bonusAdding` state.
  - Remove now-unused imports/vars (`getWeekConfig`, `SERIES`, `cfg`).

`lib/utils.js` (`getBonusPool`, `resolvePickDriver`, `stubDriver`) and the `bonusDriversByWeek` state shape are intentionally **left intact** so past weeks with populated pools keep rendering.

---

## PR 1 — Manual entry + ungating

### Task 1: Add `BonusNumberEntry` component

**Files:**
- Modify: `components/screens/DraftScreen.jsx` (add component near the other sub-components, e.g. just above `SeriesTabs` at line 514)

- [ ] **Step 1: Add the component**

Insert this component immediately before the `// ── Series tab strip ──` comment (currently line 514). It owns only its own input string + error; all authoritative validation is done by the parent's `onSubmit`, which returns an error string (shown inline) or `null` (success).

```jsx
// ── Bonus-series manual number entry ───────────────────────────────
// Replaces the pool grid for non-Cup series. The bonus driver is no longer
// chosen from an admin-curated pool — the player on the clock types the car
// number. The parent (`onSubmit`) owns range / remaining-allotment /
// per-series-uniqueness validation and returns an error string to show, or
// null on success. Non-pickers see a read-only waiting state.
function BonusNumberEntry({ series, remaining, canPick, pickerName, onSubmit }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const meta = SERIES[series] || { label: series };

  if (!canPick) {
    return <div style={{ padding:'24px 20px' }}>
      <div style={{
        background: T.card, border:`1px solid ${T.line}`, borderRadius:6,
        padding:'24px 22px', textAlign:'center',
      }}>
        <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', color: T.hot }}>{meta.label}</div>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:14, color: T.mute, marginTop:8, lineHeight:1.5 }}>
          Waiting on {pickerName || 'the picker'} to enter a {meta.label} car number.
        </div>
      </div>
    </div>;
  }

  const parsed = parseInt(val, 10);
  const hasNum = Number.isFinite(parsed);
  const submit = () => {
    const error = onSubmit(val);
    if (error) { setErr(error); return; }
    setVal(''); setErr('');
  };

  return <div style={{ padding:'18px 20px 16px' }}>
    <SectionLabel right={<span style={{ fontFamily: FI, fontStyle:'italic', fontSize:12, textTransform:'none', letterSpacing:'0.01em', color: T.ink }}>{remaining} left from this series</span>}>
      {meta.label} · Enter Car Number
    </SectionLabel>
    <div style={{ display:'flex', gap:8, marginTop:12 }}>
      <input
        value={val}
        onChange={e => { setVal(e.target.value); if (err) setErr(''); }}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        placeholder="#"
        inputMode="numeric"
        maxLength={3}
        style={{
          flex:'0 0 92px', textAlign:'center',
          fontFamily: FB, fontSize:22, fontWeight:700,
          padding:'12px 10px', borderRadius:6,
          border:`1px solid ${T.line}`, background: T.card, color: T.ink,
        }}
      />
      <button onClick={submit} disabled={!hasNum} style={{
        appearance:'none', flex:1,
        background: hasNum ? T.ink : T.bg2,
        color: hasNum ? T.bg : T.mute,
        border:'none', borderRadius:6, cursor: hasNum ? 'pointer' : 'default',
        fontFamily: FL, fontSize:11, fontWeight:600,
        letterSpacing:'0.22em', textTransform:'uppercase',
      }}>Lock in {hasNum ? `#${parsed}` : 'pick'}</button>
    </div>
    {err && <div style={{ marginTop:10, fontFamily: FI, fontStyle:'italic', fontSize:13, color: T.hot }}>{err}</div>}
  </div>;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run dev` and load the app (no usage yet, so just confirm no build error).
Expected: dev server compiles with no errors. The component is defined but not yet rendered.

- [ ] **Step 3: Commit**

```bash
git add components/screens/DraftScreen.jsx
git commit -m "feat: add BonusNumberEntry manual car-number panel"
```

---

### Task 2: Add the `tryPickBonus` handler in `DraftScreen`

**Files:**
- Modify: `components/screens/DraftScreen.jsx` (inside `DraftScreen`, immediately after the `pick` function which ends at line 213)

- [ ] **Step 1: Add the handler**

Insert directly after the closing `};` of `pick` (line 213). It mirrors the validation in `ManageDriversScreen`'s add form (`parseInt`, finite, `0–999`) for consistency, then reuses `pick()` (which independently re-checks `done`/`onClock`/`canPick`/uniqueness/remaining, so this is defense-in-depth):

```jsx
  // Manual bonus-series entry. Validates a typed car number against range,
  // remaining allotment, and per-series uniqueness, then routes through the
  // same pick() path as a grid tap by handing it a synthetic driver whose
  // name is the "#N" snapshot. Returns an error string to display, or null
  // on success.
  const tryPickBonus = (rawValue) => {
    if (done || !onClock || !canPick) return 'It is not your pick right now.';
    const n = parseInt(rawValue, 10);
    if (!Number.isFinite(n) || n < 0 || n > 999) return 'Car number must be 0–999.';
    if (remainingForPicker(activeSeries) <= 0) return 'No picks left in this series.';
    if (pickedKeys.has(pickKey(activeSeries, n))) return 'That number is already taken this week.';
    pick({ num: n, name: `#${n}` });
    return null;
  };
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run dev`
Expected: compiles with no errors. Handler defined but not yet wired to UI.

- [ ] **Step 3: Commit**

```bash
git add components/screens/DraftScreen.jsx
git commit -m "feat: add tryPickBonus validation+dispatch handler"
```

---

### Task 3: Render `BonusNumberEntry` for bonus series

**Files:**
- Modify: `components/screens/DraftScreen.jsx:309-323` (the `DraftGrid` render block)

- [ ] **Step 1: Gate the grid to Cup and add the entry panel**

Replace the existing block (lines 309-323):

```jsx
    {!done && mode === 'pick' && <DraftGrid
      drivers={activePool}
      pickedKeys={pickedKeys}
      activeSeries={activeSeries}
      draftState={draftState}
      players={players}
      onPick={pick}
      myTurn={myTurn}
      remaining={remainingForPicker(activeSeries)}
      isEmpty={activePool.length === 0}
      isAdmin={isAdmin}
      onAddDriver={() => onNav('manage-drivers')}
      driverStats={driverStats}
      freshPickKeys={freshPickKeys}
    />}
```

with:

```jsx
    {!done && mode === 'pick' && activeSeries === 'Cup' && <DraftGrid
      drivers={activePool}
      pickedKeys={pickedKeys}
      activeSeries={activeSeries}
      draftState={draftState}
      players={players}
      onPick={pick}
      myTurn={myTurn}
      remaining={remainingForPicker(activeSeries)}
      isEmpty={activePool.length === 0}
      isAdmin={isAdmin}
      onAddDriver={() => onNav('manage-drivers')}
      driverStats={driverStats}
      freshPickKeys={freshPickKeys}
    />}

    {!done && mode === 'pick' && activeSeries !== 'Cup' && <BonusNumberEntry
      series={activeSeries}
      remaining={remainingForPicker(activeSeries)}
      canPick={!!canPick}
      pickerName={currentPicker?.name}
      onSubmit={tryPickBonus}
    />}
```

- [ ] **Step 2: Manual verify the happy path**

Run: `npm run dev`, log in as the admin (can pick for anyone), go to Draft on Wk 19.
1. On the **first** pick of the draft, tap the **O'Reilly** series tab.
2. Confirm the number-entry panel appears (not the "No drivers added yet" pool message).
3. Type a number, tap **Lock in #N**.
Expected: the pick lands immediately (appears in the latest-picks strip and the board as `#N` with an "O'R" tag), the input clears, and the snake advances — all **without** having made any Cup pick first.

- [ ] **Step 3: Manual verify validation**

With the O'Reilly tab active on a pickable turn:
- Type `1000` → tap Lock in → inline error "Car number must be 0–999.", no pick.
- Clear, type a number already taken this week for O'Reilly → inline "That number is already taken this week.", no pick.
- Empty input → the Lock-in button is disabled.
Expected: all three behave as described; no pick is recorded on any error.

- [ ] **Step 4: Manual verify the spectator state**

Log in as a **non-admin** player who is **not** on the clock, open Draft on Wk 19, tap the O'Reilly tab.
Expected: a read-only "Waiting on <picker> to enter an O'Reilly car number." card — no input.

- [ ] **Step 5: Commit**

```bash
git add components/screens/DraftScreen.jsx
git commit -m "feat: use manual number entry for bonus-series picks"
```

---

### Task 4: Remove empty-pool tab gating + strip redundant name

**Files:**
- Modify: `components/screens/DraftScreen.jsx` — `SeriesTabs` (lines 518-556), its call site (lines 275-282), and `LatestPicksStrip` (line 498)

- [ ] **Step 1: Simplify `SeriesTabs` to gate on allotment only**

In `SeriesTabs`, change the signature to drop `bonusPools`:

```jsx
function SeriesTabs({ cfg, picks, pickerId, active, onSelect }) {
```

Then replace the per-series gating lines (currently 524-528):

```jsx
        const used = countPicksBySeries(picks, pickerId, series);
        const remaining = max - used;
        const pool = series === 'Cup' ? null : (bonusPools[series] || []);
        const poolEmpty = pool && pool.length === 0;
        const disabled = remaining <= 0 || poolEmpty;
```

with:

```jsx
        const used = countPicksBySeries(picks, pickerId, series);
        const remaining = max - used;
        const disabled = remaining <= 0;
```

And remove the now-meaningless `title` attribute on the button (currently line 548):

```jsx
          title={poolEmpty ? 'Admin has not added drivers for this series yet' : undefined}
```

(delete that whole line).

- [ ] **Step 2: Drop the `bonusPools` prop at the call site**

In the `DraftScreen` render, change the `<SeriesTabs .../>` block (lines 275-282) to remove the `bonusPools` prop:

```jsx
      {showSeriesTabs && <SeriesTabs
        cfg={cfg}
        picks={draftState.picks}
        pickerId={currentPicker.id}
        active={activeSeries}
        onSelect={setActiveSeries}
      />}
```

- [ ] **Step 3: Suppress the redundant `#N` name in the latest-picks strip**

In `LatestPicksStrip`, the row already prints `#{pk.driverNum}` (line 489). For manual bonus picks the resolved name is the `#N` stub, so the name span (line 498) would repeat it. Replace line 498:

```jsx
              {driver?.name || pk.driverName || ''}
```

with a guard that hides the name when it's just the number stub:

```jsx
              {(() => {
                const nm = driver?.name || pk.driverName || '';
                return nm === `#${pk.driverNum}` ? '' : nm;
              })()}
```

- [ ] **Step 4: Manual verify gating + strip**

Run: `npm run dev`, Draft on Wk 19 as admin.
1. Before any pick, confirm the **O'Reilly tab is enabled** (tappable, not greyed) even though no pool was ever populated.
2. Lock in an O'Reilly number; in the latest-picks strip the row shows the player → `#N` → "O'R" tag, with **no duplicated** `#N` text.
3. Confirm a Cup-only week (e.g. any week not in `DEFAULT_WEEK_CONFIG`) shows **no** series tabs and behaves exactly as before.
Expected: all as described.

- [ ] **Step 5: Commit**

```bash
git add components/screens/DraftScreen.jsx
git commit -m "feat: ungate bonus series tabs and de-dupe strip name"
```

- [ ] **Step 6: Full regression sweep before opening PR 1**

Run: `npm run dev`, then `npm run build` (catches unused-var/JSX errors the dev server may tolerate).
- `npm run build` completes with no errors.
- Wk 19 draft: make all 5 picks for a player mixing Cup taps and one manual O'Reilly entry, in any order (e.g. O'Reilly first). Snake advances correctly; **Undo** removes the last pick (including a manual bonus one) and frees its number for re-entry.
- Flip to **Board** mode mid-draft: the manual bonus pick renders as `#N` with the "O'R" tag.
- Open **My Team** for that player: the O'Reilly pick shows under its own labeled section as `#N` (neutral car), with the series tag.
- As admin, open **Enter Results** for Wk 19: the manually-entered O'Reilly number appears in the drafted list and accepts points.
Expected: every check passes. Then open PR `feat/manual-bonus-driver-picks` (title matches branch slug; body: what/why/how-to-verify/rollback).

**Rollback (PR 1):** revert the PR — bonus picks return to the pool grid with Cup-first/empty-pool gating. No data migration; `bonusDriversByWeek` is untouched.

---

## PR 2 — Remove the dead bonus-pool admin UI

> Ship **after** PR 1 is merged and confirmed live. Branch: `chore/remove-bonus-pool-admin`.

### Task 5: Delete bonus-pool UI, helpers, and state from Manage Drivers

**Files:**
- Modify: `components/screens/ManageDriversScreen.jsx`

- [ ] **Step 1: Remove the bonus state declaration**

Delete line 149:

```jsx
  const [bonusAdding, setBonusAdding] = useState(null); // series id when adding to a bonus pool
```

- [ ] **Step 2: Remove the bonus helpers**

Delete the entire `// ── Bonus pool helpers ──` block (lines 206-242): `bonusPool`, `removeBonus`, and `addBonus`.

- [ ] **Step 3: Remove the bonus UI block**

Delete the JSX block that renders bonus pools (lines 258-317) — the comment `{/* Bonus pools — only render if this week has bonus rounds configured */}` through the closing `</>}` immediately before `{/* Cup pool (default 36 + one-offs) */}`. The Cup Entry List section (line 319 onward) stays unchanged.

- [ ] **Step 4: Remove now-unused vars and imports**

- Delete the `cfg` declaration (line 146): `const cfg = getWeekConfig(state, currentWeek);` — it was only used by the bonus block.
- In the imports, drop `getWeekConfig` (line 5) and `SERIES` (line 4), which are now unused:
  - Line 4 becomes: `import { BONUS_SERIES_IDS, FB, FD, FI, FL, T } from '@/lib/constants';`
  - Delete line 5 (`import { getWeekConfig } from '@/lib/utils';`) entirely.
- If `npm run build` reports `BONUS_SERIES_IDS` (or any other) as now-unused, remove it too. (`BONUS_SERIES_IDS` is used elsewhere in the file's logic — keep unless the build flags it.)

- [ ] **Step 5: Verify build + behavior**

Run: `npm run build`
Expected: completes with no errors or unused-var failures.

Run: `npm run dev`, log in as admin, open **Manage Drivers** on Wk 19 (a bonus week).
Expected: no "Bonus Week" pool section renders; only the **Cup Entry List** (one-off Cup adds) remains and still works (add/remove a one-off Cup driver). The Wk 19 draft still offers manual O'Reilly entry (unchanged by this PR).

- [ ] **Step 6: Commit + open PR**

```bash
git add components/screens/ManageDriversScreen.jsx
git commit -m "chore: remove unused bonus-pool admin UI"
```

Open PR `chore/remove-bonus-pool-admin`.

**Rollback (PR 2):** revert the PR — the admin bonus-pool form returns, but it is unused by the draft (writes to `bonusDriversByWeek`, which the draft no longer reads). Harmless.

---

## Self-Review Notes

- **Spec coverage:** A (manual entry) → Tasks 1-3; B (ungating) → Task 4 Steps 1-2; C (admin cleanup) → Task 5; D (render fallbacks) → verified pre-existing via `resolvePickDriver`/`stubDriver`, with the only real gap (strip `#N` duplication) fixed in Task 4 Step 3. Uniqueness, range, numbers-only, default-Cup-tab, two-PR sequencing all reflected.
- **No new pool dependency:** new bonus picks resolve via `stubDriver` everywhere (Board, Team, History, Recap, Enter Results) — confirmed in the codebase before planning.
- **Type consistency:** `pick(driver)` consumes `{num, name}`; `tryPickBonus` constructs exactly that. `BonusNumberEntry` props (`series, remaining, canPick, pickerName, onSubmit`) match the call site in Task 3.
