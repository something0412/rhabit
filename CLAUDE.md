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
  **Light/dark mode:** `<html data-mode="dark">`, toggled by the sidebar's `ModeToggle` (saved in localStorage
  "mode", default = device setting; applied before paint by the inline script in `app/layout.tsx`). Every theme
  has a dark color set; Midnight is always dark. Fixed colors like `text-red-600` need a `dark:text-red-400` next to
  them (the `dark:` variant covers dark mode AND Midnight). Switching light/dark plays a "flip-x-in" page flip
  (browser View Transitions, CSS in globals.css under `:root[data-switching="flip"]`; instant switch in browsers
  without it or with reduced motion). Sticky notes in the Scheduler keep their own paper colors.
- **Main action buttons** (Start day, Continue, Add, Schedule it, Buy, Save, Enter demo...) use
  `components/common/HoloButton.tsx` (Lightswind holo button, lightswind.com/components/holo-button: same sizes;
  spinning rainbow border + mouse glow use per-theme `--holo-beam` / `--holo-flare` / `--holo-blend` in globals.css;
  `size="sm" | "md"`; spin off for reduced motion). Small icon buttons, tabs and
  outline/secondary buttons stay plain. `tone="theme"` (default) uses the theme's rainbow; `tone="success"`
  (green, e.g. Done) and `tone="danger"` (red, e.g. Stop now) for actions with a meaning. Glow/shine are half
  the original Lightswind strength (owner's choice).
- **Times:** never use `<input type="time">`; use `components/common/TimePicker.tsx` (our own, look based on reUI's
  Time Picker): 12-hour display with Hour/Minute/AM-PM columns, but the value stays 24-hour "HH:mm" for the API.
  Props: `minuteStep`, `clearable`. Used for the deadline, Scheduler time, and work hours.
- **Icons:** use `lucide-react` (pinned version) instead of emoji. Only the 🪙 coin and the store characters stay
  emoji. Store cards name a Lucide icon in `packages/shared/src/store.ts` (e.g. `"tree-palm"`), drawn by
  `components/common/CardIcon.tsx` (add new card icons there). The light/dark button morphs sun <-> moon with
  `morphicons` (`components/player/ModeToggle.tsx`).
- Drag and drop = native HTML5 DnD with helpers in `apps/frontend/src/lib/dragData.ts` (kinds: note, bucket, task).
  Task rows (`TaskRow.tsx`, styled after a reUI reorder-list pattern) drag only from the grip handle, using the whole
  card as the drag image; `motion.li` with `layout="position"` animates reordering.
  **Scroll focus effect** (reUI scroll-list idea, toned down), shared in `lib/scrollFocus.ts` (`useScrollFocus` +
  `focusLook`, items marked `data-focus-index`): used by the Main task list (scrolls inside `TaskList`, max 60vh)
  and the NotificationStack. The item at a focus line that slides top->bottom with scroll is full size, others
  97-98.5% / 65-90% opacity; no effect when the list fits. A task that starts running scrolls into view.
- Layout: left Sidebar (character, level, coins, tabs; reUI-style: collapses to an icon strip with the < > button,
  saved in localStorage "sidebar", applied before paint as `<html data-sidebar>`; `collapsed:` Tailwind variant
  hides labels; the active-tab highlight slides via motion `layoutId`) | page (`<main class="@container">`, use container queries
  `@lg:`/`@3xl:` not viewport breakpoints) | right NotificationStack (newest at bottom, slides up).

## Features built

- **Main tab:** Today/Tomorrow plans; modes **Timer** (sequential per-task countdowns), **Deadline** (finish by a
  time; task minutes optional), **Flexible** (no timers; minutes optional). Start, Pause (30 min free/day),
  Emergency stop (2 free/week, freezes everything; never blocked: after the free ones it costs 20 coins, or 10 XP at
  0 coins; confirm dialog auto-applies after 10s; ending the day during a *paid* stop = missed tasks cost XP only,
  a free stop excuses the day; **Deadline mode has no Pause** (server refuses it), and an emergency stop there moves
  the deadline later by the stopped time rounded UP to 30 min (`RULES.deadlineStopRoundMinutes`), stored in `day_plans.deadline_extra_seconds`,
  reset by Restart; `currentDeadline()` in shared timers), End day, **Restart day** (today only; undoes ALL of today's XP/coins,
  tasks back to planned, refunds a used Flexible card and today's emergency stops). Drag tasks to reorder (planning
  only). Task details dropdown on every task. Rule-based break suggestion after 3h in a row. Bucket drawer (auto
  opens only on the first Main visit per app load when it has items, auto closes when emptied, click outside closes it;
  `data-keep-bucket-open` marks elements that don't count as "outside"); drop bucket items between tasks.
- **Rewards:** complete task +10 XP/+5 coins, full day +30/+15, extend timer −5/−5 (timer mode only), delete after
  start −10/−10, missed −15/−15, over-pause −2/−2 per 10 min. Caps 120 XP / 60 coins earned per day; floor 0.
  100 XP per level. Tasks <10 min earn nothing; tasks with no minutes do earn. Numbers live in
  `packages/shared/src/config.ts`.
- **Mode picker** (`ModePicker.tsx`): radio cards styled after Lightswind's Smart Radio Group (a *Pro* component, so
  rebuilt from the public demo's look, not its code): icon square, radio dot, accent fill sweeps in from the left.
- **Flexible mode:** unlocked at Level 5, locked while 3+ missed tasks in the last 7 days; or use a Flexible Day card.
  The whole calendar day is the limit: **no Pause, no Emergency stop, no End day** (server refuses them); the day
  closes at midnight in the user's timezone (`flexibleDayIsOver`, via checkTimers / closeOldDays; the frontend
  asks the server when the local date changes), unfinished tasks become missed, and the full-day bonus is given
  then. Finishing every task does NOT close the day (you can add more). A **count-up timer** (`work_seconds` +
  `work_running_since` on day_plans, `flexibleWorkSeconds()`) runs from Start day while tasks are left, stops when
  all are done, restarts when a task is added. Anti-farming: a flexible task only earns if done at least
  `RULES.flexibleMinTaskMinutes` (10) after it was added (or after Start day if planned before).
- **Days off:** 1 free Day Off card per month + buy more; a planned day never started (with tasks, no day off) counts
  as missed when closed out. Old unfinished days are closed lazily on next load.
- **Store tab:** cards (Day Off 60, Flexible Day 40, Delete 15, Pause Pack 15 — auto-used), themes, characters.
- **Search:** `components/common/SearchBar.tsx` (expanding round search, reUI-based; Ctrl/Cmd+K opens, Esc clears).
  Store filters items by name/description; Scheduler filters the sticky notes by title/details (calendar shows all).
- **Profile tab:** level/XP, coins, days off, emergency stops, cards, display name, **work hours** (start, end, days).
- **Work-hour reminders** (in-app only, while app is open): "Ready to start your day?" at start, "Still working
  today?" with Start day / Take a day off 1h later. Alerts for a started task always show.
- **Notes tab:** to-dos (no timer, no rewards) + **To-do bucket** (drag notes in/out; `BucketList` shows a
  "Scheduled" group (due TODAY; always shown, "No scheduled tasks for today." when empty), "From previous days"
  (tasks missed in the last 7 days; source "missed"; re-adding or X sets `tasks.bucket_done`, re-added ones remember
  `redo_task_id` and come back if that new task is deleted), "Regular", and "Past scheduled" (scheduled in the last
  7 days, never added; starts folded); past things drop out after `RULES.bucketPastDays` = 7; each group folds, in both the Main drawer and
  the Notes box; on the Notes tab the bucket box is capped at 2/3 and Assigned at 1/3 of the screen (minus the
  page header), each scrolling inside) + **Assigned** section (notes
  that became a task; they can't be re-bucketed — anti-farming; deleting the task returns the note).
- **Scheduler tab:** tasks for a future date (optional time/minutes) shown as **sticky-note calendar cards**; on that
  date they appear in the bucket (+ one notification per day). Deleting the resulting task returns it to the bucket.
  Right column: `ScheduleCalendar` (our own month grid, no calendar library; layout based on a reUI pattern): dots
  in each task's sticky-note color, selected day's tasks below (only that list scrolls, with the scroll focus effect,
  and each has an X to delete it), + fills the form's date. The page header (title + search) is sticky, and the
  calendar is pinned under it (the page measures the header's height and passes `--calendar-top`).

## Not built yet / next ideas

- Real sign-up/login (owner wants to implement it themself), Supabase RLS policies for real users.
- **Phone / portrait layout (needed for MVP):** not done yet. At 375px wide the Sidebar (w-56) + NotificationStack
  (w-80) leave the page 0px wide. Needs: sidebar -> bottom tab bar or slide-out menu, notifications -> overlay toasts,
  bucket drawer -> bottom sheet, Scheduler calendar stacks. Use Tailwind `portrait:` / `landscape:` (already used:
  task details preview is 1 line landscape, 2 lines portrait in `TaskRow.tsx`) plus container queries.
- Push notifications when the app is closed (Web Push + scheduled job).
- AI features: cheap-model point-farming detection (app's key), help chatbot, smarter break suggestions, BYOK.
- **Assistant connector (after MVP):** an MCP server on the backend so the user's own assistant (owner uses Meta's
  Muse; MCP also works with others) can talk to the app by voice/chat, with OAuth "connect" per user. Tools are
  **planning-only** (read today/progress, add/schedule tasks, add notes); never complete tasks, start/end days, or
  touch XP/coins (anti-farming). Needs real login + RLS + deployed backend first. Check Meta's current connector docs
  before building: whether small apps can connect directly was unclear in Oct 2026.
- Mobile app (Expo in `apps/mobile`, reusing `packages/shared` and the same API).
- Deployment to Vercel (two projects), a real Supabase project, Git repo + GitHub.

## Testing habits that worked

- Test the backend against a **separate database file** so the owner's demo data is untouched:
  `PORT=4555 LOCAL_DB_FILE=<scratchpad>/test.json node --import tsx src/index.ts` (in apps/backend), then a small
  Node script with `fetch` calls. Stop it by its task id afterwards.
- The owner usually has `npm run dev` running (ports 3000/4000) — don't kill those processes. Never use broad
  `taskkill`/`pkill`; stop only processes you started, by PID.
- In the browser, native drag can't be simulated with the mouse tool; dispatch `dragstart/dragover/drop` events with
  a `DataTransfer` via JS. If you create test data in the owner's app, name it "Claude test ..." and delete it after.
