# Discipline Planner — project guide for Claude

A productivity app that trains self-discipline: plan your day, run a timer per task (or race a daily deadline),
earn **XP** (levels) and **coins** (store), and lose them for missed tasks. Built by a student who is still
learning; code must stay easy to read.

## How the owner wants code written (important)

- **API calls are written inline, never wrapped.** Use the shared axios instance directly inside the component's
  handler: `const res = await api.post<DayResponse>(\`/tasks/${id}/complete\`)` inside `try { } catch (error) { }`.
  Do NOT create helper functions like `getDay()` / `completeTask()` that hide the call. No `fetch`.
- **No Prisma / no ORM.** The backend talks to the database with `supabase-js` (`supabase.from("tasks").select(...)`).
- Keep it beginner-readable: plain names, short comments explaining *why*, no clever abstractions.
- TypeScript everywhere. Types use the database's **snake_case** column names so data passes through unchanged.
- Explain new tech in plain words when introducing it (the owner asks "what does X do?").
- The owner decides product rules. When a rule is ambiguous or affects rewards/penalties, ask before building.
- Watch for **XP/coin farming exploits** in every feature (the owner cares a lot about this).
- **Git commits:** never add `Co-Authored-By: Claude`, "Generated with Claude Code", or any mention of Claude/AI.
  Commits use the owner's git identity and describe only what changed and why. Commit only when asked.

## Stack and layout (npm workspaces monorepo, one Git repo, two Vercel projects later)

```
apps/frontend   Next.js 16 (App Router) + Tailwind v4 + motion, port 3000   -> Vercel Root Directory: apps/frontend
apps/backend    Express 5 + supabase-js, run with tsx, port 4000          -> Vercel Root Directory: apps/backend
packages/shared types, REWARDS/RULES config, store items, timer math, levels, work hours (used by both apps)
```

- Run both: `npm run dev` (root). Typecheck both: `npm run typecheck`.
- Next 16: `apps/frontend/AGENTS.md` (auto-generated) says to check `node_modules/next/dist/docs/` before using
  unfamiliar Next APIs.
- **Database:** Supabase if `apps/backend/.env` has `SUPABASE_URL` + `SUPABASE_SECRET_KEY`; otherwise a local demo
  DB (`apps/backend/src/localDb.ts`, data in `apps/backend/.local-db.json`) that mimics the supabase-js calls we use
  (`select/insert/update/delete/eq/neq/gt/gte/lt/lte/in/is/order/limit/single/maybeSingle`, `count: "exact", head`).
  If you use a new supabase-js method, add it to localDb too. Schema: `apps/backend/supabase/schema.sql`
  (8 tables: profiles, day_plans, tasks, reward_events, pause_events, inventory, notes, scheduled_tasks).
  When adding columns: update schema.sql, the shared types, AND localDb `defaults` (localDb upgrades old files by
  filling defaults; bump `VERSION` only for additive changes).
- **No real auth yet** (owner wants to learn it later). Frontend sends header `x-user-id: demo-user`
  (`apps/frontend/src/lib/api.ts`); backend `middleware/demoUser.ts` trusts it. Later: verify a Supabase JWT there.
- Every `/days` and `/tasks` endpoint returns the full `DayResponse` (day, tasks, profile, status, reward_changes);
  the Main page saves it with `handleUpdate`, which also updates the sidebar (PlayerProvider) and shows notifications.
- All XP/coin changes go through `changeRewards()` in `apps/backend/src/lib/rewards.ts` (daily caps, floor at 0,
  writes the reward_events ledger). Never change xp/coins anywhere else.
- Theme colors are CSS variables (`bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, ...) in
  `apps/frontend/src/app/globals.css`; never hard-code slate/indigo colors. 5 themes incl. dark "Midnight".
- Drag and drop = native HTML5 DnD with helpers in `apps/frontend/src/lib/dragData.ts` (kinds: note, bucket, task).
- Layout: left Sidebar (character, level, coins, tabs) | page (`<main class="@container">`, use container queries
  `@lg:`/`@3xl:` not viewport breakpoints) | right NotificationStack (newest at bottom, slides up).

## Features built

- **Main tab:** Today/Tomorrow plans; modes **Timer** (sequential per-task countdowns), **Deadline** (finish by a
  time; task minutes optional), **Flexible** (no timers; minutes optional). Start, Pause (30 min free/day),
  Emergency stop (2/week, freezes everything), End day, **Restart day** (today only; undoes ALL of today's XP/coins,
  tasks back to planned, refunds a used Flexible card and today's emergency stops). Drag tasks to reorder (planning
  only). Task details dropdown on every task. Rule-based break suggestion after 3h in a row. Bucket drawer (auto
  opens when the bucket has items, auto closes when emptied); drop bucket items between tasks.
- **Rewards:** complete task +10 XP/+5 coins, full day +30/+15, extend timer −5/−5 (timer mode only), delete after
  start −10/−10, missed −15/−15, over-pause −2/−2 per 10 min. Caps 120 XP / 60 coins earned per day; floor 0.
  100 XP per level. Tasks <10 min earn nothing; tasks with no minutes do earn. Numbers live in
  `packages/shared/src/config.ts`.
- **Flexible mode:** unlocked at Level 5, locked while 3+ missed tasks in the last 7 days; or use a Flexible Day card.
- **Days off:** 1 free Day Off card per month + buy more; a planned day never started (with tasks, no day off) counts
  as missed when closed out. Old unfinished days are closed lazily on next load.
- **Store tab:** cards (Day Off 60, Flexible Day 40, Delete 15, Pause Pack 15 — auto-used), themes, characters.
- **Profile tab:** level/XP, coins, days off, emergency stops, cards, display name, **work hours** (start, end, days).
- **Work-hour reminders** (in-app only, while app is open): "Ready to start your day?" at start, "Still working
  today?" with Start day / Take a day off 1h later. Alerts for a started task always show.
- **Notes tab:** to-dos (no timer, no rewards) + **To-do bucket** (drag notes in/out) + **Assigned** section (notes
  that became a task; they can't be re-bucketed — anti-farming; deleting the task returns the note).
- **Scheduler tab:** tasks for a future date (optional time/minutes) shown as **sticky-note calendar cards**; on that
  date they appear in the bucket (+ one notification per day). Deleting the resulting task returns it to the bucket.

## Not built yet / next ideas

- Real sign-up/login (owner wants to implement it themself), Supabase RLS policies for real users.
- Push notifications when the app is closed (Web Push + scheduled job).
- AI features: cheap-model point-farming detection (app's key), help chatbot, smarter break suggestions, BYOK.
- Mobile app (Expo in `apps/mobile`, reusing `packages/shared` and the same API).
- Deployment to Vercel (two projects), a real Supabase project, Git repo + GitHub.
- Open decision: should Flexible mode ever give/take XP? (`RULES.flexibleModePenalties`, currently false).

## Testing habits that worked

- Test the backend against a **separate database file** so the owner's demo data is untouched:
  `PORT=4555 LOCAL_DB_FILE=<scratchpad>/test.json node --import tsx src/index.ts` (in apps/backend), then a small
  Node script with `fetch` calls. Stop it by its task id afterwards.
- The owner usually has `npm run dev` running (ports 3000/4000) — don't kill those processes. Never use broad
  `taskkill`/`pkill`; stop only processes you started, by PID.
- In the browser, native drag can't be simulated with the mouse tool; dispatch `dragstart/dragover/drop` events with
  a `DataTransfer` via JS. If you create test data in the owner's app, name it "Claude test ..." and delete it after.
