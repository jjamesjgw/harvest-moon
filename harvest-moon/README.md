# Harvest Moon — Deployment Guide

This is a Next.js + Supabase project. Everyone in the league sees the same data in real time — when you make a pick, Trey's screen updates within a second.

**No coding required. Follow these steps exactly.**

---

## What you'll do (takes ~20 min)

1. Put this project on GitHub
2. Set up the Supabase database (paste one SQL snippet, grab 2 keys)
3. Deploy to Vercel (2 env vars, one click)
4. Share the URL with your league

You already created accounts for GitHub, Supabase, and Vercel — good.

---

## Step 1 · Put the project on GitHub

**1a.** Go to https://github.com/new

**1b.** Fill in:
- Repository name: `harvest-moon`
- Privacy: **Private** (recommended)
- Leave the rest of the settings as they are.
- Click **Create repository**

**1c.** GitHub now shows you a page with instructions. Leave it open.

**1d.** Unzip this project on your Mac to a folder like `~/Desktop/harvest-moon/`.

**1e.** Open the **Terminal** app (Cmd+Space, type "Terminal"). Paste this, one line at a time, pressing Return after each. Replace `YOUR-USERNAME` with your GitHub username.

```bash
cd ~/Desktop/harvest-moon
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/harvest-moon.git
git push -u origin main
```

Terminal will ask you to sign in to GitHub. If it asks for a password, use a **personal access token** instead (GitHub → Settings → Developer Settings → Personal Access Tokens → Generate new token → check `repo` → Generate → copy and paste).

When it finishes, refresh your GitHub repo page. You should see all the files.

---

## Step 2 · Set up the Supabase database

Your Supabase project is already created (`harvest-moon`). Now we add one table and turn on realtime.

**2a.** Go to https://supabase.com/dashboard → click your `harvest-moon` project.

**2b.** In the **left sidebar**, click the **SQL Editor** icon (looks like `>_`).

**2c.** Click **+ New query** (top left).

**2d.** Open the file `supabase/schema.sql` from this project (in TextEdit or any editor). **Copy the entire contents.**

**2e.** Paste it into the Supabase SQL editor. Click **Run** (bottom right, or Cmd+Return).

You should see a green "Success. No rows returned" message.

**2f.** Now grab your API keys. In the **left sidebar**, click the **gear icon** (Settings) → **API Keys**.

You'll see two things you need. Keep this tab open:
- **Project URL** (looks like `https://iwopirihcohecmbhzqkf.supabase.co`)
- **anon / public key** — this is the `anon` row, NOT the `service_role` one. It's a long string starting with `eyJ...`. Click the **Copy** button.

**Do not share the `service_role` key anywhere. We only use the `anon` key.**

---

## Step 3 · Deploy to Vercel

**3a.** Go to https://vercel.com/new

**3b.** If prompted, connect your GitHub account. Then find `harvest-moon` in the list and click **Import**.

**3c.** Vercel shows a deployment configuration screen. Scroll down to **Environment Variables**. Add **three** variables:

| Name                              | Value                                             |
| --------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | your Project URL from step 2f                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | your anon key from step 2f                       |
| `NEXT_PUBLIC_LEAGUE_ID`           | `harvest-moon`                                   |

For each one: type the name, paste the value, click **Add**.

**3d.** Click **Deploy**. Wait ~60 seconds.

**3e.** When done, Vercel shows a screen with confetti and a preview. Click **Continue to Dashboard**, then click the **Visit** button to open your live site.

**It's live. That URL (something like `harvest-moon-abc123.vercel.app`) is what you share with your league.**

---

## Step 4 · First-time setup in the app

The first person to open the app sees the Setup screen to name the 6 league members. **Justin should do this first** so he gets PIN access automatically. Make sure one of the members is exactly named `Justin`.

Once saved, everyone else opens the URL and picks their name from the login card.

---

## Custom domain (optional)

If you bought `harvestmoon.app` or similar, in Vercel: project → Settings → Domains → Add. Vercel walks you through the DNS records.

---

## How to make changes later

Any time you want to edit something:
1. Edit the code on your Mac
2. In Terminal: `cd ~/Desktop/harvest-moon && git add . && git commit -m "change X" && git push`
3. Vercel auto-deploys in ~60 seconds. Everyone's app reloads with the new version.

Or ask Claude to make the change and re-zip — replace the files and repeat.

---

## If something breaks

- **Blank screen on the live site?** Open the Vercel dashboard → your project → Deployments → click the latest → View Function Logs. There's usually a clear error there.
- **"Loading league…" never goes away?** Your Supabase env vars are wrong. Vercel → Settings → Environment Variables → verify, then Deployments → the latest → `...` → Redeploy.
- **Realtime not updating?** Confirm step 2e ran cleanly (the schema.sql includes the `alter publication` line that turns realtime on for this table).

---

## What you just built

- A Next.js app hosted on Vercel's global CDN (free, fast)
- A Postgres database on Supabase with realtime WebSocket subscriptions (free)
- A PWA your friends can install on their phone home screen (iOS: Share → Add to Home Screen. Android: browser prompts automatically)
- Shared state across all 6 devices — every tap, pick, and result is instantly visible to everyone else

Enjoy the season.
