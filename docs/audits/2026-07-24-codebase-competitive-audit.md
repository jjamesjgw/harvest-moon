# Harvest Moon — Codebase & Competitive Audit

**Date:** 2026-07-24 · **Scope:** entire repo at `1392fae`, plus competitive analysis vs. Sleeper, ESPN/Yahoo, Underdog/PrizePicks, DraftKings NASCAR DFS, NASCAR Fantasy Live, and F1 Fantasy.

**How it was run:** five parallel code auditors (architecture, security, UI/UX, scoring correctness, platform/PWA), three researchers (Sleeper deep-dive, fantasy landscape, small-league engagement), plus a completeness critic that triggered three follow-up investigations (disaster recovery, commissioner bus-factor, doc drift). Every claimed defect was then adversarially re-verified by an independent pass that read the actual code and tried to refute it: **12 claims verified → 11 confirmed, 1 refuted** (the refuted one is documented below so it doesn't resurface).

---

## TL;DR

The core is genuinely strong. The single-JSONB-document model is the right architecture at this scale and it is defended with real depth: CAS writes, three layers of wipe guards, fail-closed snapshots, append-only history, HMAC sessions with timing-safe compares, account lockout + IP throttle. The UI delivers the "quiet luxury editorial" brand with unusual discipline — every screen actually uses the T tokens and the five font constants.

Three things need attention, in order:

1. **Three date-fused defects** are already scheduled to fire: the **wk 25 Richmond ingest will silently import the wrong race's results on Aug 15** (duplicate "Cook Out 400" name + the escape-hatch comment documents the wrong week key), the **cron schedule misses all three remaining Saturday-night races** (first one: that same Aug 15), and the **championship race can never count in standings** (season-end off-by-one, fires in November).
2. **The cron ingest bypasses the app's own concurrency protection** (plain upsert, seconds-scale `write_id`), which both races against client writes and re-opens the exact stale-write hole the CAS RPC was built to close.
3. **The product gap vs. Sleeper-class apps is not mechanics — it's the ritual/social layer.** The scoring, draft, and realtime engine are already competitive. What's missing is what makes small leagues sticky: the auto-recap, the picks reveal, race-day live scoring, streaks/rivalries/records, and the season ceremony. Almost all of it is derivable from data already in Supabase.

---

## 1. What's working (don't touch these)

- **Defense-in-depth on the league document.** Client fresh-shape gate (`fetchSucceeded`+`meId`), shared `isFreshShaped` tripwire, route preflight, CAS RPC restricted to service_role, DB pre-update guard trigger, fail-closed `withSnapshot` before every destructive op. This is real, not checkbox security.
- **`useLeague` is a strong offline-first sync hook**: localStorage mirror, debounced writes with backoff, realtime echo suppression via `client_tag`, stale-write 409 convergence, visibility-return refresh for iOS's socket-killing. The "drop pending writes when remote state arrives" policy is a documented, correct trade-off.
- **Auth is proportionate and clean**: HMAC-SHA256 HttpOnly SameSite=Strict cookie, timing-safe compares, `verify_pin` SECURITY DEFINER over deny-all RLS, `FOR UPDATE`-locked account lockout that bounds 4-digit brute force regardless of IP games.
- **Design-system discipline is excellent.** All 16 screens use T tokens + FB/FD/FI/FL/FM with a consistent grammar. The skeleton mirrors the Home layout, error copy is human and categorized, empty states are in-voice, destructive actions are type-RESET-guarded.
- **The live draft experience already rivals commercial apps**: on-the-clock banner, personal copper toast + haptics, JustPickedToast, fresh-pick animations, board/pick modes, undo, admin override.
- **Pure logic is properly layered**: `scoring.js`/`utils.js` shared by client and server, one implementation each of scoring and turn detection. The codebase reads like a maintained postmortem log — comments cite the incident that motivated each guard.
- **Single-page shell routing is the right call.** Do **not** migrate screens to App Router routes; that trades instant in-memory transitions for per-route loading states with zero benefit here.

---

## 2. Verified defects — the fix-now list

All confirmed by adversarial verification against the code as written. Ordered by urgency.

| # | Defect | Where | Deadline |
|---|--------|-------|----------|
| D1 | Wk 25 Richmond ingest resolves the wk 7 Martinsville Wikipedia slug → silently imports the wrong race's points; the only documentation of the override writes it to the wrong week key (24, is actually 25) | `lib/raceFeed.js:18`, `lib/data.js:64,93`, `app/api/ingest-results/route.js:115` | **Aug 15** |
| D2 | Cron misses Saturday-night races: only Sun 23:00 + Mon 01/03/05 UTC runs. Richmond (Aug 15), Daytona II (Aug 29), Bristol (Sep 19) are Saturday nights → results arrive ~19h late | `vercel.json:3-6` | **Aug 15** |
| D3 | Ingest bypasses CAS: plain `upsert` + `write_id` in **seconds** (clients use ms). Client writes racing the 8s ingest window are clobbered; after ingest, the row's `write_id` drops ~1000×, so any stale client retry passes strict-greater CAS and can erase fresh results | `app/api/ingest-results/route.js:157-168` | now |
| D4 | `findTargetRace` never skips the All-Star week → wk 13 re-fetched every cron run forever; if the All-Star article ever parses, exhibition points silently overwrite the 50/0 scoring and rewrite season standings | `app/api/ingest-results/route.js:75-94` | now |
| D5 | Season-end off-by-one: `currentWeek` can never pass 37, and standings compute `throughWeek = currentWeek - 1` → **the championship race never counts; the displayed champion can be wrong** | `EnterResultsScreen.jsx:385`, `StandingsScreen.jsx:193`, `HomeScreen.jsx:363-364` | **before Nov 8** |
| D6 | In-progress results rows leak as completed weeks: `patchWeek` writes a `weeklyResults` row on the first keystroke; Recap labels it "Final", History counts it, Standings' By-Week includes it, and the notify trigger pushes "results posted" mid-entry. Only HomeScreen checks `finalized` | `RecapScreen.jsx:44`, `HistoryScreen.jsx:40`, `StandingsScreen.jsx:216`, `MoreScreen.jsx:14` | now |
| D7 | Push deep links are dead: payloads set `/?screen=draft` but nothing ever parses `?screen=`; `sw.js` also force-`navigate()`s an open window (full SPA reload) → the "you're on the clock" tap lands on Home, slowly | `app/api/notify/route.js:54,71,83`, `public/sw.js:25-33`, `HarvestMoon.jsx:89` | now |
| D8 | `push_subs` is world read/write/delete via the shipped anon key (`anon all using(true)`): anyone can dump endpoints, delete every subscription, or insert a row with your `player_id` pointing at their own browser to receive your targeted pushes | `baseline.sql:246-247`, `supabase/push.sql:27-28`, `lib/push.js` | soon |
| D9 | Fresh-project migration replay leaves the notify trigger POSTing to a literal `REPLACE_WITH_NOTIFY_URL` — silently (pg_net result discarded); re-running the "idempotent" baseline on the live DB would also reset the hand-patched function to placeholders | `baseline.sql:206-231`, `docs/push-setup.md:36` | DR risk |
| D10 | README/docs drift that misdirects mid-incident: README cron times are two months stale, env table omits `SESSION_SECRET` (login 500s on a rebuilt deploy), `lib/supabase/` dir doesn't exist, `schema.sql` still says "paste me" but creates a guard-less schema missing `client_tag` (would break every save), baseline references a deleted doc | `README.md:44-56,109`, `supabase/schema.sql:2`, `baseline.sql:18` | now (cheap) |
| D11 | Recap deep-link week is consumed on mount then falls back to the newest row one frame later; combined with D6, tapping "Last Race · Recap" mid-entry shows the partial week | `RecapScreen.jsx:25-28,43-44` | with D6 |

**Refuted claim (for the record):** "EnterResultsScreen's conditional `useState` after the All-Star early-return crashes React when the week advances." The verifier reproduced the exact structure empirically with react@19.2.0 — a 0-hook→1-hook transition selects the mount dispatcher and does **not** throw. It's latent fragility (adding a second hook to the regular path would make it real), worth a defensive reorder someday, but it is not a bug today.

Other unrefuted-but-unverified small defects found by direct reading: slot-pick `choose()` doesn't re-validate inside its updater (double-assigned slot silently drops a player from the snake order — the same #44-class hardening `pick()`/`undo()` already have); an all-zero week credits all six players a "win" in `computeStandings`; the Reset modal's `position:fixed` is broken by PullToRefresh's always-on `transform`; `AppFrame`'s width `useState` causes a desktop hydration mismatch; the 3s boot timeout can flash LoginScreen at a signed-in user on a slow cold start.

---

## 3. Architecture & code quality

**The one structural seam worth fixing:** raw vs. migrated state duality. Screens render `migrateState(rawState)` but `setState` updaters receive the **raw** Supabase payload — so `s.schedule`/`s.drivers` are stale inside every updater, a rule enforced only by four scattered 30-line comments, and it has already shipped one real bug (PR #20 class). Either pipe updater input through `migrateState` (stripping render-only overlays before persist), or persist the overlays once and delete the read-time overlay.

Related: one-shot JSONB migrations run as client-side React effects (the All-Star wk-shift, the schedule persist), each re-deriving the subtle gating rules. Add a `docVersion` int and a single ordered list of pure migration functions in `lib/migrations.js` — the two existing effects become migrations 1 and 2, and every future document evolution becomes a testable pure function.

**Zero tests over highly testable code.** The riskiest logic is pure and I/O-free: `rollupPts` + legacy key fallback, `buildSnakeOrder`, `buildSlotPickOrder` tiebreakers, `computeStandings`, `detectActiveTurn`, `parseRaceTime` DST edges, `isFreshShaped`, the Wikipedia parser. Every incident cited in comments was a state-transition bug a unit test would have caught. Add vitest; a day's work covers the whole layer.

**No error boundary anywhere.** Any render throw white-screens the PWA. All state lives in Supabase + localStorage, so recovery is always just a reload — wrap `{screens[screen]}` in a ~30-line boundary with a branded reload card, plus `app/error.jsx`, plus a ~30-line `window.onerror` beacon posting to a `/api/log` route that `console.error`s into Vercel logs. That converts "Boomer texts: the app is broken" into a stack trace.

**Small cleanups:** `resolveDriverByPick`/`stubDriverFromPick` are dead byte-for-byte duplicates of `resolvePickDriver`/`stubDriver` (each claiming to be the single source of truth); the driver-pool resolution is still re-inlined in HomeScreen, EnterResultsScreen, HarvestMoon (justPicked), and DraftScreen; `makeFreshState` writes a dead `meId` field into the shared document; server routes duplicate the admin-client + `originAllowed` boilerplate four times (extract `lib/db/admin.js`).

**TypeScript migration order** (when it starts): type the `LeagueState` document first — its shape currently exists nowhere except implicitly, and shape drift is the dominant bug class. Then `lib/` (pure, mechanical), then `useLeague` + the `/api/league` payload contract. Screens last or never; they're presentation over a typed core.

**Concurrency model:** `write_id = Date.now()` with strict-greater CAS is last-write-wins by sender clock, not true compare-and-swap. At 6 users with turn-based drafting this is an *acceptable, correctly-judged* trade-off — flagged so it's a conscious decision. If it ever bites during a live draft, move to a server-assigned version echo. Until then, leave it.

---

## 4. Security

Threat model honestly: six trusted friends, public internet. The write path, PIN auth, and session construction are genuinely good (see §1). What remains:

1. **`push_subs` lockdown (D8)** — the only unauthenticated write surface reachable with the shipped anon key. Route subscribe/unsubscribe through authenticated `/api/push/*` handlers (player_id from the cookie, service-role write), drop the `anon all` policy in a real migration, and move the secret-free DDL under `supabase/migrations/`.
2. **`/api/league` never checks `isAdmin`** — every commissioner-only action is enforced in JSX only. Any of the six players' cookies can rewrite results, `currentWeek`, or a teammate's picks (contrast: reset and snapshot routes *do* enforce). For this league that's an acceptable honor-system — but make it a *documented* acceptance, and consider the one cheap guard: reject non-admin writes that change `currentWeek`.
3. **Hardening nits:** CRON_SECRET compared with `===` while the INGEST/NOTIFY paths use `timingSafeEqual` (make them match); IP throttle keys off leftmost `x-forwarded-for` token (client-influencable — prefer `x-real-ip`; the account lockout remains the real backstop); 30-day stateless cookies have no revocation short of rotating `SESSION_SECRET` (accepted); the SW should refuse cross-origin push-payload URLs before `navigate()` (defense-in-depth); league state + full history are world-readable via the anon key (by design — document it).

Also worth knowing: the anon `leagues_history` INSERT hole was already found and closed (migration `20260603130000`), and the DDL event trigger auto-enables RLS on new tables. Good posture.

---

## 5. UI/UX & design

The brand is delivered; the gaps are legibility, native-feel, and two flow papercuts.

**Highest-leverage fix — self-host the fonts.** The entire identity rides on five families injected via a `useEffect`-created `<link>` — guaranteed Helvetica flash on every cold start (iOS reaps this PWA constantly), system fonts when offline. Move to `next/font/google` in `app/layout.jsx` and re-export the generated stacks through the same FD/FI/FL/FB/FM names; no screen changes. Add preconnects for the Supabase origin while in there. This is the single cheapest "feels premium" upgrade available.

**Legibility pass.** 6-8px labels on the draft board/roster strips are below readable on a phone in sunlight; `T.mute` (#86806F on #F7F4ED) measures ~3.6:1 — under AA — and it's the color of nearly every label in the app. Floor informational text at 9px, darken mute one step (~#6E6858 clears 4.5:1 and keeps the warmth). Also: re-enable pinch zoom (`maximumScale:1, userScalable:false` currently blocks magnifying the board — WCAG 1.4.4), one `prefers-reduced-motion` block for the four infinite animations, and 44pt effective hit areas for LinkArrow/sort chips (padding offset by negative margins — SaveBanner already does this correctly).

**Navigation.** Wire the existing in-memory stack to the History API (push an entry per `onNav`, `popstate` → `goBack()`): Android back stops exiting the PWA, iOS gets edge-swipe, BackChip stays. Flatten the two-row More sub-screens (League/History) into MoreScreen — Drivers is currently 3 taps deep; keep the Commissioner grouping. Swap StatOfTheSeason below YourRosterStrip on Home so your roster outranks trivia on race weekend.

**Draft screen density.** The sticky header (TopBar + OnTheClock + toggle + picks strip + tabs + undo row) pins up to ~half the viewport on bonus weeks; the driver grid — the thing the picker scans — gets the rest. Keep only OnTheClock sticky.

**PWA gaps.** The 35-line SW caches nothing and is only registered if you enable push: no-signal cold start (parking lot, track dead zone) shows a browser error page even though full league state sits in localStorage. Register the SW at boot, precache the shell with a versioned cache + `clients.claim()` discipline (today's "never stale" property must be preserved deliberately). Split manifest icons into separate `any`/`maskable` entries, add iOS splash images, add an Android install prompt branch (`beforeinstallprompt` is never captured).

**Brand details.** The share card — the one artifact that represents the league in the group chat — renders in Helvetica; `document.fonts.load('700 96px Archivo')` before drawing fixes it. TrackTypeBadge reuses the PlayerBadge formula *and* player identity colors (a green "SH" circle reads as Tone) — change shape or shift to neutral tints. Dark mode: not a defect, but if ever wanted, first migrate T tokens to CSS custom properties behind the same names — the inline-style architecture makes the cost grow with every screen shipped before that seam exists.

---

## 6. Reliability & operations

This dimension came from the completeness critic and it found the scariest structural stuff.

**Bus factor is 1 on an app whose weekly heartbeat is manual.** `ADMIN_ID` is one hardcoded person; week advancement is the only path that re-arms the next draft and it's admin-only; PIN resets and onboarding require raw SQL in Justin's Supabase account; all eight secrets live in Justin's Vercel. If Justin is unreachable on a race weekend, the league freezes at "Waiting on commissioner." Fixes, cheapest first:
1. `ADMIN_IDS` array with a designated backup (three exact-match sites to update: login route, `HarvestMoon.jsx:161`, ProfileScreen).
2. Auto-advance deadman: extend the ingest cron to advance the week server-side once Cup points are in and a pre-race cutoff passes; manual advance stays primary.
3. `set_pin` SECURITY DEFINER migration + admin-gated route + small commissioner UI (kills the raw-SQL dependency for resets *and* onboarding step 2).
4. A one-page CONTINUITY.md + second-operator access on Vercel/Supabase/GitHub.

**Every recovery layer lives inside the same Postgres instance.** `leagues_history`, `leagues_snapshots`, pg_cron — all die with the Supabase project. One weekly cron route exporting `leagues.state` JSON off-instance (email or Vercel Blob, ~50 lines) closes it.

**DR has never been drilled and would fail today**: replayed migrations leave push silently dead (D9), the restore runbook doesn't set `client_tag`/`write_id` (the device that wrote the bad state suppresses the restore as its own echo), there's no documented snapshot-restore SQL, and `schema.sql` sits there as a trap. Run one drill against a scratch project; fix what it surfaces; write `docs/dr-runbook.md`. Root-fix D9 by moving the notify URL/secret to Supabase Vault (or a service-role config table) so the function body is committed and the baseline becomes genuinely idempotent.

**No CI at all.** No `.github/`, no lint config, no test script — only Vercel's build gate. Even just vitest + a ~20-line Node doc-drift check (cron entries ↔ README; `process.env.*` ↔ `.env.example`) would have caught both drifts that currently misdirect incident debugging.

**Season archival — must land before the first reset.** `resetSeason` wipes `weeklyResults`/`draftHistory`; 2026 would survive only in service-role-only snapshots invisible to the app. Fold `{year, finalStandings, weeklyResults, draftHistory}` into `state.pastSeasons` before the wipe and give History a season switcher. For a friends league, last season's bragging rights are half the product — this converts the reset from a data funeral into a rollover, and it's the foundation for the entire Record Book product direction below.

---

## 7. Competitive analysis

### What Sleeper actually teaches

Sleeper's thesis: **chat is the product; fantasy is the content generator** (~50 min/day in-season). But the research's clearest finding is that this *doesn't transplant* to six close friends — see anti-features. What does transplant:

- **Automated rituals beat commissioner energy.** The Tuesday Weekly Report (highest/lowest score, blowout, luck awards) manufactures a guaranteed weekly conversation moment with zero human effort. Small leagues die when rituals depend on one person.
- **Involuntary bragging rights are nearly free.** The League Legend champion badge is un-removable — even by the commissioner. That's the design detail that makes it needle the group all season.
- **History is the retention moat.** Legacy leagues, trophy cases, record books — Sleeper built a backfill editor precisely because leagues weigh their archive when choosing platforms.
- **Speed is trust.** "Scores update before the TV shows it" is what makes it the mandatory second screen.
- **Two cautionary tales:** they pulled mascot animations off the matchup screen (identity was cluttering data), and their nav redesign angered veterans despite testing well with new users. Both validate this repo's existing constraints: restraint, and never relocating working flows mid-season.

### What the racing-fantasy landscape teaches

- **NASCAR Fantasy Live** is the most stealable blueprint: garage driver with a swap window until Stage 3, driver usage caps (10 regular season / 5 playoffs), stage-point scoring, four +10 head-to-head driver picks per week. All map cleanly onto the slot-pick model.
- **Stages are the structural insight** generic fantasy lacks: three scoring checkpoints per race = three moments of hope/dread instead of one. Flat weekly totals throw away the sport's native rhythm.
- **DraftKings DFS** solved "the finish isn't the whole race": laps-led/fastest-lap dominator points, place differential (start 30th → finish 10th = +20 feels like the win it is).
- **Underdog/PrizePicks** won on decision minimalism (one number, two buttons) + streak loss-aversion — the cheapest proven retention mechanic here, fully derivable from existing pick history.
- **ESPN FantasyCast**: all six totals pinned during the live event, drill-down without losing context.
- **Key unlock:** nearly every high-value feature keys off **two cheap data captures the app doesn't store yet — per-stage top-10s and start position**. One additive schema step (new `driverPoints` keys, legacy fallback already exists in `lookupPts`) unlocks stage breakdowns, dominator bonuses, movers/fallers, and post-qualifying value.

### Anti-features — explicitly do NOT build

1. **No in-app chat.** At 6-person scale the existing group text wins on inertia and notification primacy; one holdout kills any migration; Sleeper's chat advantage materializes at 10+ with looser graphs. The correct posture: **arm the group chat** — the share-card generator *is* the chat strategy (this is the model Fantasy Sports Reports literally sells).
2. **Never exceed ~3-5 pushes per race week.** Research: 43% disable notifications at 2-5/week, 60% abandon above 5. Fixed ritual beats only — and deadline reminders target *only members who haven't picked*.
3. **No generic gamification** (XP, badge cabinets, levels) and no public/discovery surfaces. Six friends run on named, specific lore — "the Lantern," a 14-9 rivalry record — not points inflation.
4. **Pride-only side bets.** No money handling; the league settles over Venmo and trash talk anyway.
5. **No App-Router screen migration, no framework/state-library adoption, no dark-mode rewrite** without the CSS-variable seam first.

---

## 8. Product roadmap

Tiered for a season already in progress. Everything is additive and independently shippable as one-concern PRs.

### Tier 1 — this season (mostly pure derivation over existing data)

1. **The Beat Writer: auto weekly recap.** After ingest, generate the race report: hero/bust of the week, "best driver left in the garage" (optimal-lineup delta from `scoring.js`), biggest standings mover, tightest rivalry swing, power-ranked 1-6 with one-liners, editorial share card (Fraunces headline, copper award marks) → results push carries the headline; cards are paste-ready for the group text. Highest conversation-per-line-of-code in the entire roadmap; runs on the pipeline that already exists.
2. **Notification choreography.** Four fixed beats: picks-open, deadline reminder (*non-pickers only* — kills the missed-picks failure mode), green-flag reveal, results drop. Requires fixing D7 (deep links) first so every push lands on the right screen. Per-moment toggles on Profile.
3. **Simultaneous picks reveal.** Hide others' slot picks until lock, then reveal all six side-by-side with overlaps and contrarian picks highlighted, plus a share card. Wordle's mechanic, native to NASCAR's lineup-lock. Mostly a visibility rule + one screen.
4. **Pick lock at green flag** (also a fairness defect — see §2 notes): wire `parseRaceTime` into pick/undo/slot paths, visible "Field is locked" state, admin override for late drafts.
5. **Race-day live league strip.** Six member tiles with provisional "points as they run" (running order via `raceFeed.js` mapped through the existing points table), owner-colored drafted-field leaderboard, position deltas. Label provisional; ingest stays the source of truth. This is the second-screen habit-former — six phones open for three hours every Sunday.
6. **Champion + Lantern marks.** Reigning champ's copper laurel and last place's Tail Lantern next to their names everywhere, applied automatically, removable by no one.

### Tier 2 — at a season boundary (small schema additions)

7. **Capture stage top-10s + start position** in EnterResults/ingest under new additive keys → then, as separate PRs: stage-by-stage scoring breakdowns (stacked bars on Recap/Team), movers & fallers deltas, optional dominator bonuses (laps led / stage win, small and capped).
8. **Head-to-head matchup props**: 2-4 driver pairs weekly, two-tap picks, flat +10, auto-resolved from finishing order (`rollupPts` already accepts a bonuses map).
9. **Driver Survivor side pool**: pick one top-10 finisher weekly, never reuse a driver, one miss eliminates. Keeps 6th place glued to race day in October.
10. **Garage swap slot**: one bench driver swappable until Stage 3 — converts Tuesday set-and-forget into a live race-day decision.
11. **Usage caps / one-shot chips** (Boost = 2× one driver; Mulligan = drop worst pick — both expressible through existing `overrides`/`bonuses` hooks): portfolio strategy across a 37-race season.
12. **Streaks**: consecutive on-time picks, consecutive top-3 weeks, "streak at risk" pre-lock nudge. Free from existing history.

### Tier 3 — offseason (the institution layer)

13. **Record Book** (built on the §6 season archive): season pages, all-time records, per-member trophy shelves, the 15 pairwise **rivalry records** ("Justin leads Dana 14-9; Dana has won 3 straight") surfaced on results cards.
14. **Season Banquet / Wrapped**: auto superlatives, per-member share-card sequence, champion's privilege recorded for next season; a **Season Time Machine** bump-chart replay of the standings race (the data already exists in history).
15. **NASCAR-native texture**: Manufacturer Cup (declared Chevy/Ford/Toyota allegiance, season sub-standings, factions guaranteed at 6 people), track-type splits ("road course savant"), Chaos Week framing for superspeedways, event-matched Quote of the Week (the quotes file exists — pick by what happened, not week number).
16. **League playoffs**: seed all six from regular-season standings into elimination rounds across the real playoff races (wks 28-37), Championship 4 at Homestead — the most NASCAR-native structure available.
17. **Silly Season mode**: preseason predictions ballot (champion, Daytona 500 winner, first DNF) locked in February, scored in November — fills the 3-month dark window.
18. **Printable Season Yearbook**: extend the canvas share-card renderer into a multi-page PDF keepsake.

---

## 9. Suggested PR sequence (near-term)

Per the one-concern-per-PR rule, in priority order:

1. `fix/wk25-richmond-wiki-slug` — D1: `wikiSlug` field on schedule entries, prefer it in `deriveWikiSlug`, fix the wk-24 comment. **Before Aug 15.**
2. `chore/saturday-night-crons` — D2: add Sunday-morning runs (e.g. `0 6,15 * * 0`); verify the Vercel plan allows it. **Before Aug 15.**
3. `fix/ingest-cas-write-id` — D3: `Date.now()` ms + route ingest through `upsert_league_with_cas`, re-merge on stale.
4. `fix/ingest-skip-allstar` — D4: skip `format === 'all-star'` and finalized weeks in `findTargetRace`.
5. `fix/finalized-weeks-filter` — D6+D11: shared `finalizedWeeks()` helper in Recap/History/Standings/More; latch Recap's `viewWk`.
6. `fix/push-deep-links` — D7: parse `?screen=` on boot (whitelisted); SW focus+postMessage instead of navigate.
7. `fix/season-end-standings` — D5: season-complete flag, include wk 37 in standings, unlock the seasonOver path. **Before November.**
8. `docs/runbook-drift` — D10: README cron/env/layout fixes, retire `schema.sql`, fix the dead baseline reference.
9. `db/push-subs-lockdown` — D8: authed `/api/push/*` routes + migration dropping `anon all`.
10. `feat/error-boundary-beacon` — boundary + `app/error.jsx` + crash beacon.
11. `feat/admin-ids-backup` — bus-factor step 1.
12. `feat/season-archive` — `pastSeasons` before any reset happens.
13. `feat/next-font-self-host` — the fonts fix.
14. Then Tier 1 product work, starting with the Beat Writer recap.

---

*Full agent findings (5 dimension audits, 3 research tracks, 12 verification verdicts, critic + 3 gap investigations) were generated during the audit session; this document is the synthesis. Line numbers reference commit `1392fae`.*
