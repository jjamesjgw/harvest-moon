# Past One-Off Driver Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "pick from past weeks" chip picker inside the Add One-Off Cup Driver form on Manage Drivers, so admins re-add recurring part-time drivers (e.g. Corey Heim) without re-typing name/team/livery.

**Architecture:** Pure client-side derivation. Compute `cupHistory` by walking existing `state.weekDriversExtra` history; dedup by car number with most-recent winning; filter out drivers already on this week's Cup roster. Pass as a new optional `history` prop to the existing `AddDriverForm` component, which renders a chip section above the manual fields when non-empty. Tapping a chip pre-fills form state; admin reviews and submits via the existing path.

**Tech Stack:** Next.js 16 (App Router) · React 18 · plain JavaScript (no TS yet) · existing `CarNum` / `T` (tokens) / font constants from `lib/constants.js`. No test framework configured in this repo — verification is manual via `npm run dev` (per the project's established pattern; recent fix PRs follow the same approach).

**Spec:** `docs/superpowers/specs/2026-05-21-past-one-off-driver-picker-design.md`

**Branch:** `feat/past-one-off-driver-picker` (already created off `main`, spec already committed at HEAD)

---

## File Structure

All changes land in a single file. No new files; no migrations; no API changes.

- **Modify:** `components/screens/ManageDriversScreen.jsx`
  - Add `cupHistory` derivation inside `ManageDriversScreen` (after the existing `currentCupNums` declaration)
  - Pass `history={cupHistory}` to the Cup `AddDriverForm`
  - Extend `AddDriverForm` to accept a `history` prop and render a chip picker above the manual fields when non-empty

---

## Task 1: Derive `cupHistory` and pipe it to the Cup AddDriverForm

**Files:**
- Modify: `components/screens/ManageDriversScreen.jsx:95` (after the `currentCupNums` line, add derivation) and `:258` (pass new prop)

- [ ] **Step 1: Add the `cupHistory` derivation**

In `components/screens/ManageDriversScreen.jsx`, locate the existing block (post-PR #56 state):

```jsx
  // Scope to the current week — part-time drivers from prior weeks
  // (in weekDriversExtra) must remain re-addable when they run again.
  const currentCupNums = new Set(drivers.map(d => d.num));
```

Immediately after that block, insert:

```jsx
  // History of every past one-off Cup driver, dedup'd by car number with
  // the most-recent entry winning, filtered to numbers not already on
  // this week's roster. Surfaced as a tap-to-prefill picker in the Add form.
  const cupHistory = (() => {
    const byNum = new Map();
    const weeksDesc = Object.keys(state.weekDriversExtra || {})
      .map(Number)
      .filter(n => Number.isFinite(n) && n !== currentWeek)
      .sort((a, b) => b - a);
    for (const wk of weeksDesc) {
      for (const driver of ((state.weekDriversExtra || {})[wk] || [])) {
        if (byNum.has(driver.num)) continue;
        if (currentCupNums.has(driver.num)) continue;
        byNum.set(driver.num, { ...driver, lastSeenWeek: wk });
      }
    }
    return Array.from(byNum.values());
  })();
```

Note: `n !== currentWeek` in the week filter ensures we don't show this-week's-own additions as "past" suggestions (defense in depth; `currentCupNums` would already filter them, but excluding the current week from the iteration is cheaper and clearer).

- [ ] **Step 2: Pass the new prop to the Cup AddDriverForm**

Locate the existing Cup AddDriverForm invocation (around line 255):

```jsx
        <AddDriverForm
          title={`New Cup driver for Wk ${String(currentWeek).padStart(2,'0')}`}
          existingNums={currentCupNums}
          onCancel={() => setAdding(false)}
          onAdd={addCupExtra}
        />
```

Add the `history` prop:

```jsx
        <AddDriverForm
          title={`New Cup driver for Wk ${String(currentWeek).padStart(2,'0')}`}
          existingNums={currentCupNums}
          history={cupHistory}
          onCancel={() => setAdding(false)}
          onAdd={addCupExtra}
        />
```

Leave the bonus-pool AddDriverForm invocations (around line 202) **unchanged** — they continue to omit `history`, which defaults to `[]` and renders the picker section as hidden.

- [ ] **Step 3: Verify it compiles**

Run:

```bash
npm run build
```

Expected: Turbopack compile succeeds; TypeScript step succeeds. (The `/api/*` route page-data-collection step will fail locally if `NEXT_PUBLIC_SUPABASE_URL` is not set in your shell — this is pre-existing and unrelated to this change. The compile step is what verifies our edit.)

- [ ] **Step 4: Commit**

```bash
git add components/screens/ManageDriversScreen.jsx
git commit -m "$(cat <<'EOF'
feat: derive cupHistory and pass to Cup AddDriverForm

Computes a dedup'd, recency-ordered list of past one-off Cup drivers
from state.weekDriversExtra, filtered to numbers not already on this
week's roster. Wired as a new optional history prop on the Cup
AddDriverForm invocation; bonus-pool forms unchanged (default []).

No user-visible change yet — picker rendering arrives in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Render the chip picker inside AddDriverForm

**Files:**
- Modify: `components/screens/ManageDriversScreen.jsx:9` (extend `AddDriverForm` signature) and `:23-50` (add chip section to its returned JSX)

- [ ] **Step 1: Extend the component signature**

Locate the existing function declaration (line 9):

```jsx
function AddDriverForm({ onCancel, onAdd, existingNums = new Set(), title }) {
  const [d, setD] = useState({ num:'', name:'', team:'', primary:'#14110D', secondary:'#F7F4ED' });
  const [err, setErr] = useState(null);
```

Replace with:

```jsx
function AddDriverForm({ onCancel, onAdd, existingNums = new Set(), title, history = [] }) {
  const [d, setD] = useState({ num:'', name:'', team:'', primary:'#14110D', secondary:'#F7F4ED' });
  const [err, setErr] = useState(null);
  const [expanded, setExpanded] = useState(false);
```

- [ ] **Step 2: Add the chip picker section above the existing form fields**

Locate the start of the returned JSX (line 23) — currently:

```jsx
  return <div style={{ borderTop:`0.5px solid ${T.line}`, borderBottom:`0.5px solid ${T.line}`, padding:'14px 0', display:'flex', flexDirection:'column', gap:8 }}>
    {title && <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', color: T.hot, marginBottom:2 }}>{title}</div>}
    <div style={{ display:'flex', gap:6 }}>
      <input value={d.num} onChange={e => setD({...d, num: e.target.value})} placeholder="#" maxLength={3}
```

Insert the chip picker block between the `{title && ...}` line and the `<div style={{ display:'flex', gap:6 }}>` input row. The full updated section (replace the lines above through to the second `<input>` line is unchanged — we only insert a new fragment between):

```jsx
  return <div style={{ borderTop:`0.5px solid ${T.line}`, borderBottom:`0.5px solid ${T.line}`, padding:'14px 0', display:'flex', flexDirection:'column', gap:8 }}>
    {title && <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', color: T.hot, marginBottom:2 }}>{title}</div>}

    {history.length > 0 && (() => {
      const visible = expanded ? history : history.slice(0, 6);
      const hidden = Math.max(0, history.length - 6);
      const prefill = (h) => {
        setD({
          num: String(h.num),
          name: h.name,
          team: h.team === '—' ? '' : h.team,
          primary: h.primary,
          secondary: h.secondary,
        });
        setErr(null);
      };
      return <>
        <div style={{ fontFamily: FL, fontSize:9, fontWeight:600, letterSpacing:'0.22em', textTransform:'uppercase', color: T.mute, marginTop:2 }}>From past weeks</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {visible.map(h => (
            <button
              key={h.num}
              type="button"
              onClick={() => prefill(h)}
              style={{
                appearance:'none',
                background: T.card,
                border: `1px solid ${T.line}`,
                borderRadius: 3,
                padding: '6px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                color: T.ink,
              }}
            >
              <CarNum driver={h} size={22}/>
              <span style={{ fontFamily: FD, fontSize: 13, fontWeight: 600, letterSpacing: '-0.02em' }}>{h.name}</span>
            </button>
          ))}
          {!expanded && hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              style={{
                appearance:'none',
                background: T.card,
                border: `1px solid ${T.line}`,
                borderRadius: 3,
                padding: '6px 10px',
                cursor: 'pointer',
                fontFamily: FL, fontSize: 10, fontWeight: 600,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: T.mute,
              }}
            >+ {hidden} more</button>
          )}
        </div>
        <div style={{ fontFamily: FI, fontStyle:'italic', fontSize:11, color: T.mute, marginTop:2 }}>or enter a brand-new driver</div>
      </>;
    })()}

    <div style={{ display:'flex', gap:6 }}>
      <input value={d.num} onChange={e => setD({...d, num: e.target.value})} placeholder="#" maxLength={3}
```

Confirm `CarNum` is already imported at the top of the file — it is, on line 3: `import { BackChip, CarNum, SectionLabel, TopBar } from '@/components/ui/primitives';`. No new imports needed.

- [ ] **Step 3: Verify it compiles**

```bash
npm run build
```

Expected: Turbopack compile succeeds; TypeScript step succeeds. (Same caveat about local Supabase env vars from Task 1 — pre-existing, unrelated.)

- [ ] **Step 4: Commit**

```bash
git add components/screens/ManageDriversScreen.jsx
git commit -m "$(cat <<'EOF'
feat: render past-one-off chip picker in AddDriverForm

When `history` is non-empty, AddDriverForm now renders a "From past
weeks" chip row above the manual fields. Each chip uses the CarNum
primitive + driver name; tapping pre-fills the form state from the
historical entry. Falls back to the existing manual flow if history
is empty or admin wants to enter a brand-new driver.

Bonus-pool forms unaffected (they pass no `history` prop, which
defaults to []).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Manual verification

This project has no automated test framework. Verification is in the browser against the dev server, following the test plan from the spec (`docs/superpowers/specs/2026-05-21-past-one-off-driver-picker-design.md` §6).

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000` (default Next dev port). Open the app in a browser, log in as the admin user. Navigate to Manage Drivers via More → Manage Drivers (or via the `+ Add Cup Driver` button on the Draft screen when on the Cup tab).

- [ ] **Step 2: Verify empty-history rendering**

Pre-condition: a fresh `weekDriversExtra: {}` (or a state where no past weeks have any extras).

- Tap **"+ Add One-Off Cup Driver for Wk NN"**.
- Expected: the form opens with the title "New Cup driver for Wk NN" and the existing # / Name / Team / Livery fields. **No** "From past weeks" section appears.

Mark this step done only if the empty case renders byte-identically to today's behavior.

- [ ] **Step 3: Verify single-entry history**

Setup: in the open form, manually add Corey Heim — `#67`, name `Corey Heim`, team `TRICON Garage`, primary `#9A2D2D`, secondary `#FDFAF0`. Tap Add. Confirm he appears in the Cup Entry List below.

Now advance to the next week (Enter Results → finalize race, OR if you're testing without a finalized race, manually edit the state-blob `currentWeek` to a week without extras — admin only, dev convenience).

Reopen Manage Drivers and tap **"+ Add One-Off Cup Driver for Wk NN"**.

- Expected: the form opens with a single chip in a "From past weeks" section: a CarNum #67 in Heim's livery, with the name "Corey Heim" beside it. Below it: italic caption "or enter a brand-new driver". Below that: the empty # / Name / Team / Livery fields.

- [ ] **Step 4: Verify chip tap pre-fills the form**

Tap the Corey Heim chip.

- Expected: the # field shows `67`, the Name field shows `Corey Heim`, the Team field shows `TRICON Garage`, and both color swatches show Heim's livery (red primary, off-white secondary). Any prior error text under the form is cleared.

Tap **Add** (without editing anything).

- Expected: Heim appears in the Cup Entry List for this week. The form closes.

Reopen the form.

- Expected: the Heim chip is now **absent** from the picker (he's on this week's roster, so the §1.2 filter excludes him). The form is otherwise empty.

- [ ] **Step 5: Verify multi-entry recency ordering**

Setup: with Heim already on this week, also add (via the manual path) two more one-offs *in past weeks* of your test state — e.g. Connor Zilisch #88 in Wk N-2 and Jimmie Johnson #84 in Wk N-1.

Advance to Wk N+1 (clean of extras). Open the Add form.

- Expected: chips appear in order **Johnson #84, Zilisch #88** (Heim #67 is omitted because he's still on this week's roster from Step 4). Most-recent week first.

- [ ] **Step 6: Verify the `+ N more` expansion**

Setup: synthesize a `weekDriversExtra` state with 8+ unique car numbers across multiple past weeks (admin can use the state-blob editor or run through several adds). Re-open the form.

- Expected: 6 chips visible plus a `+ N more` button (with N = total - 6). Tap the expand button — all remaining chips appear inline. The button disappears.

- [ ] **Step 7: Verify edit-after-prefill**

Tap a chip, then manually change the Team field to `"Test Edit Inc"`. Tap **Add**.

- Expected: the driver lands in the Cup Entry List with team `"Test Edit Inc"` (not the historical team). Open the form again; the chip for that driver now shows the original historical team (because the chip data wasn't mutated — only the form state was). This is acceptable: the next add of this driver will use the most-recent week's entry, which is the new one we just added.

Actually — confirm one more nuance: re-open the form in a *future* week (advance again). The chip for that driver now shows the **updated** team (because the new add wrote a more recent `weekDriversExtra` entry). ✓ Recency-wins.

- [ ] **Step 8: Verify validation still fires**

Tap a chip to prefill, then manually change the # to `24` (William Byron, a full-timer). Tap **Add**.

- Expected: error text appears: `#24 is already in this pool.` No driver added.

- [ ] **Step 9: Verify the picker is absent for bonus pools**

Navigate to a bonus week (one where `cfg.bonusSeries.length > 0` — e.g. an All-Star week). Tap **"+ Add Truck Driver"** (or whatever bonus series the week has).

- Expected: the form opens with **no** "From past weeks" section regardless of bonus history. Bonus-pool flow is unchanged from today. (v1 deferral per spec §1.)

- [ ] **Step 10: Visual sanity check**

On a phone-width viewport (≤ 414px wide), confirm:
- Chips wrap to multiple rows rather than overflowing horizontally.
- Chip tap target is large enough to hit comfortably (`padding: 6px 10px` plus CarNum 22px ≈ 34px tall — comfortably above the 24px minimum).
- The italic "or enter a brand-new driver" caption is readable but quiet.
- The existing manual fields still align as before.

If anything looks off, capture a screenshot, file a follow-up note, but don't block on minor polish unless layout is broken.

---

## Task 4: Open the PR

**Files:** none (git/gh only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/past-one-off-driver-picker
```

Expected: branch published; `gh pr create` URL printed.

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat: pick from past one-offs in Add Cup Driver form" --body "$(cat <<'EOF'
## Summary
- Add a "From past weeks" chip picker inside the Add One-Off Cup Driver form on Manage Drivers. Chips are derived from `state.weekDriversExtra` (dedup'd by car number, most-recent first, filtered to drivers not already on this week's roster).
- Tapping a chip pre-fills the # / Name / Team / Livery fields with the driver's most recent known values. Admin can edit (e.g. for a sponsor/team change) and submit via the existing path.
- Empty history → picker section is hidden entirely; form is byte-identical to today's behavior.
- Bonus-pool forms are unchanged in this PR (v1 scope per spec).

## Spec
- `docs/superpowers/specs/2026-05-21-past-one-off-driver-picker-design.md`

## Why this is correct
- Pure client-side derivation from existing state. No new state shape, no migration, no API surface, no RLS impact.
- The existing `existingNums` validation still runs on submit, so chip-prefill + manual-edit collisions (e.g. changing # to a full-timer) are still rejected.
- The picker only renders for the Cup form. Bonus AddDriverForm invocations omit the new `history` prop, which defaults to `[]`.

## Test plan
- [ ] Empty history (no past extras): picker section absent
- [ ] Single-entry history: one chip; tap pre-fills the form
- [ ] Tap chip, hit Add, reopen form: that driver no longer appears as a chip (already on this week's roster)
- [ ] Multi-entry history: chips in most-recent-week-first order
- [ ] >6 entries: 6 visible + "+ N more" expansion
- [ ] Edit after prefill: edited team wins on submit; future weeks see the updated entry
- [ ] Manual # collision after prefill (e.g. change to #24): existing validation error fires
- [ ] Bonus-pool form: picker section absent (unchanged behavior)
- [ ] Phone-width: chips wrap; layout intact

## Rollback
- Single-file revert of `components/screens/ManageDriversScreen.jsx`. No data shape, no migration, no API.

## Follow-ups (out of scope here)
- Extend the picker to bonus pools (Trucks, Xfinity, ARCA, etc.)
- History management UI (remove typo'd entries)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Confirm in browser that the diff is scoped to `components/screens/ManageDriversScreen.jsx` (plus the spec/plan docs from earlier commits on this branch).

- [ ] **Step 3: Done**

Report the PR URL back to the user.

---

## Self-Review

**Spec coverage:**
- §1.1 Source → Task 1 Step 1 (`Object.keys(state.weekDriversExtra)`).
- §1.2 Derivation rules (descending week, dedup by num, exclude rostered, track lastSeenWeek) → Task 1 Step 1 (all four rules implemented in the IIFE).
- §1.3 Shape → produced by Task 1 Step 1.
- §1.4 Placement / no `useMemo` → Task 1 Step 1 (plain IIFE, no memoization, per spec guidance).
- §2.1 Component contract (optional `history` prop, default `[]`, preserved props) → Task 2 Step 1.
- §2.2 Chip picker layout (label, chip row, "+ N more" expansion, divider caption) → Task 2 Step 2.
- §2.3 Submission unchanged → Task 2 Step 2 leaves `submit()` untouched.
- §2.4 Bonus-pool reuse (no `history` prop on bonus forms) → Task 1 Step 2 explicitly leaves bonus invocations alone.
- §3 Implementation touchpoints → Tasks 1 and 2.
- §4 Edge cases (empty, all-rostered, ≤6, >6, edit-after, cancel, recency, collision, realtime) → covered in Task 3 Steps 2–10.
- §5 Rollback → PR body documents single-file revert.
- §6 Test plan → Task 3 mirrors the spec's manual test plan one-to-one.

**Placeholder scan:** No "TBD", no "add appropriate error handling", no "similar to Task N", no missing code blocks. Each step has full code or full command.

**Type consistency:**
- `cupHistory` produces objects with `num`, `name`, `team`, `primary`, `secondary`, `lastSeenWeek` (Task 1 Step 1). The chip-tap `prefill(h)` reads exactly these fields except `lastSeenWeek` (which is intentionally unused in v1 — kept on the object for future "last seen Wk NN" display). Consistent.
- `history` prop name matches between caller (Task 1 Step 2) and callee (Task 2 Step 1). ✓
- `expanded` / `setExpanded` declared in Task 2 Step 1 and used in Task 2 Step 2. ✓
- `setD` and `setErr` are pre-existing (line 10–11 of the file), reused unchanged. ✓

**Verification cadence:** Each implementation task ends with a build verification and a commit, so the branch stays in a working state per commit. Task 3 is a single dedicated verification task using the spec's test plan. No intermediate checkpoint is needed — the surface area is one file.

No issues found.

---

## Execution Notes

- **Branch is pre-staged.** You're already on `feat/past-one-off-driver-picker`. The spec commit is HEAD. Tasks 1 and 2 add two more commits before pushing.
- **Bug fix PR #56** is independent and already open against `main`. Do not rebase this feature branch onto PR #56 — when #56 merges to `main`, this branch should be rebased then. The picker code does not depend on the #56 fix to compile (it depends on it semantically — the spec assumes #56 has unblocked re-adding part-timers — but the rendering logic itself is independent).
- **Manual verification only.** No test framework. Don't introduce one in this PR; it's out of scope and would be its own larger discussion.
