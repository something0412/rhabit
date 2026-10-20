# Discipline Planner

Plan your day, give every task a timer (or the whole day a deadline), and earn XP (levels) and coins (store) for finishing what you planned.

## Project structure

```
productivity/
  apps/
    frontend/  Next.js frontend (port 3000)  -> Vercel project #1 (Root Directory: apps/frontend)
    backend/   Express backend (port 4000)   -> Vercel project #2 (Root Directory: apps/backend)
  packages/
    shared/     Types, rewards config, store items and timer math used by BOTH apps
```

### How a request flows

```
Button click in apps/frontend
  -> await api.post("/tasks/12/complete")         (axios, apps/frontend/src/lib/api.ts)
  -> Express route in apps/backend/src/routes/tasks.ts
  -> supabase.from("tasks").update(...)           (apps/backend/src/supabase.ts)
  -> responds with the whole updated day as JSON
  -> the page saves it with setData(...)
```

## First-time setup

**No Supabase yet?** Skip steps 1-2. Without keys, the backend saves to a local demo database (`apps/backend/.local-db.json`). Delete that file to start fresh.

1. **Create the tables.** In your Supabase project, open **SQL Editor**, paste `apps/backend/supabase/schema.sql`, and run it.
2. **Backend env.** Copy `apps/backend/.env.example` to `apps/backend/.env` and fill in `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
   (Supabase dashboard -> Project Settings -> API).
3. **Frontend env (optional).** Copy `apps/frontend/.env.example` to `apps/frontend/.env.local`. The default already points at `http://localhost:4000`.
4. **Install everything** (from this root folder):

   ```bash
   npm install
   ```

## Run it

```bash
npm run dev
```

This starts both apps. Open http://localhost:3000 and click **Enter demo**.

## Where to change things

| What | File |
|---|---|
| XP/coin values, caps, pause allowance, flexible-mode rules | `packages/shared/src/config.ts` |
| Store items and prices | `packages/shared/src/store.ts` |
| Timer math | `packages/shared/src/timers.ts` |
| Rewards rules (daily caps, floor at 0) | `apps/backend/src/lib/rewards.ts` |
| Level, flexible-mode status, free monthly Day Off card | `apps/backend/src/lib/player.ts` |
| Themes (colors) | `apps/frontend/src/app/globals.css` |
| Day rules (start next task, missed tasks, finishing) | `apps/backend/src/lib/days.ts` |
| API endpoints | `apps/backend/src/routes/*.ts` |
| Pages | `apps/frontend/src/app/(app)/main`, `.../notes`, `.../scheduler`, `.../store`, `.../profile` |
| To-do bucket (what's in it, moving items to a plan) | `apps/backend/src/routes/bucket.ts` |
| Drag and drop helpers | `apps/frontend/src/lib/dragData.ts` |
| Work-hour reminders | `apps/frontend/src/components/player/WorkReminders.tsx` |
| Notification stack | `apps/frontend/src/components/notifications/` |

## Not built yet

- Real login (the demo user is sent as an `x-user-id` header; see `apps/backend/src/middleware/demoUser.ts`)
- Push notifications when the app is closed
- AI features, mobile app
