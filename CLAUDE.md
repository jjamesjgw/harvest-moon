# Harvest Moon

Private 6-person NASCAR fantasy league app.

## Stack
- Next.js App Router (JavaScript, incremental TypeScript planned)
- Supabase (Postgres + Realtime). Auth is a custom PIN + HMAC `hm_session` cookie — **not** Supabase Auth. Supabase Storage is not used.
- Vercel (deploys; auto-deploys `main`)
- React 19

## Brand & Design System
- Aesthetic: quiet luxury editorial — warm paper, deep ink, copper accents
- Type constants in code: FB (Manrope body), FD (Archivo display), FI (Fraunces italic serif), FL (Archivo Narrow labels), FM (JetBrains Mono) — these are real, do not invent new ones
- Tokens (T) and font stacks live in `lib/constants.js`

## Hard Constraints
1. Don't break working flows. When in doubt, ship additive rather than replace.
2. One concern per PR. Justin reviews via GitHub UI.
3. No bundled feature releases. Sequence independent deploys.
4. Preserve existing constants and conventions even if they look unusual.
5. Database changes go through `supabase/migrations/*.sql` only. Never modify production via the dashboard.
6. RLS is non-negotiable on every table.
7. Never reset, clear, or reseed league/season data without explicit confirmation naming exactly what will be affected.

## Working Files (canonical)
- App routes: `app/` (JSX — the repo is JavaScript today; no `.ts` files yet)
- Components: `components/`
- Route handlers: `app/api/` (admin, auth, ingest-results, league, notify)
- Supabase client: `lib/supabase.js`
- Tokens & font stacks: `lib/constants.js`
- Scoring / race data: `lib/scoring.js`, `lib/raceFeed.js`, `lib/data.js`
- Migrations: `supabase/migrations/`

## Commit / PR Conventions
- Branch: `kind/short-slug` — kinds: `feat`, `fix`, `chore`, `audit`, `refactor`, `db`, `docs`
- PR title matches branch slug
- PR body: what changed, why, how to verify, rollback notes

## Vocabulary
- "push/merge to production", "make it live" = commit → PR → merge to `main` → Vercel auto-deploys → verify the live site
- Terse replies ("1", "A", "do it") refer to the most recent numbered options — echo the chosen action in one line before executing

## Environment (Justin's machine)
- Windows 11. Repo on `S:`; home and `~/.claude` on `C:`.
- No python on PATH — use Node for scripts and local servers.
- Pick one shell dialect per command (PowerShell cmdlets fail in Git Bash and vice versa).
- Temp files go in the session scratchpad, never `S:\tmp` (doesn't exist).
- Local preview: `http://127.0.0.1:<port>`, not `localhost`.
