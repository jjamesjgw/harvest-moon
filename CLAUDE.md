# Harvest Moon

Private 6-person NASCAR fantasy league app.

## Stack
- Next.js App Router (JavaScript, incremental TypeScript planned)
- Supabase (Postgres + Auth + Realtime + Storage)
- Vercel (deploys)
- React 18

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

## Working Files (canonical)
- App routes: `app/`
- Components: `components/`
- Server actions / route handlers: `app/api/`, `app/**/actions.ts`
- Supabase client: `lib/supabase/`
- Tokens: `lib/tokens.*`
- Migrations: `supabase/migrations/`

## Commit / PR Conventions
- Branch: `kind/short-slug` — kinds: `feat`, `fix`, `chore`, `audit`, `refactor`, `db`
- PR title matches branch slug
- PR body: what changed, why, how to verify, rollback notes
