import { Router } from "express";
import type { DayMode, RewardEvent } from "@productivity/shared";
import { RULES } from "@productivity/shared";
import { supabase } from "../supabase";
import { HttpError, parseId } from "../httpError";
import { addDays, nowIso, todayIn } from "../lib/dates";
import { addItem, useItem } from "../lib/inventory";
import { getProfile, grantMonthlyDayOff, playerStatus } from "../lib/player";
import { addNote, changeRewards } from "../lib/rewards";
import {
  addTaskToDay,
  checkTimers,
  closeOldDays,
  closePauseEvents,
  dayResponse,
  emergencyStopsLeft,
  endPause,
  finishDay,
  getDay,
  getTasks,
  record,
  startNextTask,
  updateDay,
  updateTask,
} from "../lib/days";

const router = Router();

// GET /days/today   or   GET /days/tomorrow
// Finds the plan for that date (or creates an empty one).
router.get("/:which", async (req, res) => {
  const { which } = req.params;
  if (which !== "today" && which !== "tomorrow") {
    throw new HttpError(400, "Use /days/today or /days/tomorrow");
  }

  const profile = await getProfile(req.userId);
  const today = todayIn(profile.timezone);
  const date = which === "today" ? today : addDays(today, 1);

  const changes: RewardEvent[] = [];
  record(changes, await grantMonthlyDayOff(profile));

  // Finish any old days the user never closed (missed tasks get penalized)
  changes.push(...(await closeOldDays(req.userId, today)));

  let { data: day, error } = await supabase
    .from("day_plans")
    .select("*")
    .eq("user_id", req.userId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;

  if (!day) {
    const { data: created, error: insertError } = await supabase
      .from("day_plans")
      .insert({ user_id: req.userId, date })
      .select()
      .single();
    if (insertError) throw insertError;
    day = created;
  }

  // Timers may have run out while the app was closed
  await checkTimers(day, req.userId, changes);

  res.json(await dayResponse(req.userId, day.id, changes));
});

// PATCH /days/:id  { mode?, deadline_at? }   (only before the day starts)
router.patch("/:id", async (req, res) => {
  const day = await getDay(parseId(req.params.id), req.userId);
  if (day.status !== "planning") throw new HttpError(400, "You can only change the mode before the day starts");

  const mode: DayMode = req.body.mode ?? day.mode;
  if (!["timer", "deadline", "flexible"].includes(mode)) throw new HttpError(400, "Invalid mode");

  if (mode === "flexible") {
    const status = await playerStatus(await getProfile(req.userId));
    const hasCard = (status.inventory.flexible_card ?? 0) > 0;
    if (!status.flexible.unlocked && !hasCard) {
      throw new HttpError(403, "Flexible mode is locked. Reach the level, or buy a Flexible Day card in the Store.");
    }
  }

  // Timer mode gives every task a countdown, so every task needs minutes
  if (mode === "timer") {
    const missing = (await getTasks(day.id)).filter((t) => t.duration_minutes === null);
    if (missing.length > 0) {
      throw new HttpError(400, `Give these tasks minutes first: ${missing.map((t) => `"${t.title}"`).join(", ")}`);
    }
  }

  const deadlineAt = req.body.deadline_at === undefined ? day.deadline_at : req.body.deadline_at;
  await updateDay(day.id, { mode, deadline_at: deadlineAt });

  res.json(await dayResponse(req.userId, day.id));
});

// POST /days/:id/start
router.post("/:id/start", async (req, res) => {
  const day = await getDay(parseId(req.params.id), req.userId);
  const profile = await getProfile(req.userId);
  const changes: RewardEvent[] = [];

  if (day.status !== "planning") throw new HttpError(400, "This day has already started");
  if (day.date !== todayIn(profile.timezone)) throw new HttpError(400, "You can only start today's plan");

  const tasks = await getTasks(day.id);
  if (!tasks.some((t) => !t.is_break)) throw new HttpError(400, "Add at least one task first");
  if (day.mode === "timer" && tasks.some((t) => t.duration_minutes === null)) {
    throw new HttpError(400, "In timer mode every task needs minutes");
  }

  if (day.mode === "deadline") {
    if (!day.deadline_at) throw new HttpError(400, "Set a deadline first");
    if (Date.parse(day.deadline_at) <= Date.now()) throw new HttpError(400, "The deadline is already in the past");
  }

  // Flexible mode while it's locked uses up a Flexible Day card
  if (day.mode === "flexible") {
    const status = await playerStatus(profile);
    if (!status.flexible.unlocked) {
      await useItem(req.userId, "flexible_card", "Flexible mode is locked and you have no Flexible Day card");
      record(changes, await addNote(req.userId, "Used a Flexible Day card", day.id));
      await updateDay(day.id, { flexible_card_used: true });
    }
  }

  const started = await updateDay(day.id, { status: "active", started_at: nowIso() });
  await startNextTask(started); // timer mode: first task's timer starts now

  res.json(await dayResponse(req.userId, day.id, changes));
});

// POST /days/:id/day-off   (uses a Day Off card: no penalties, no rewards, no reminders)
router.post("/:id/day-off", async (req, res) => {
  const day = await getDay(parseId(req.params.id), req.userId);
  const profile = await getProfile(req.userId);

  if (day.status !== "planning") throw new HttpError(400, "You can only take a day off before the day starts");
  if (day.date < todayIn(profile.timezone)) throw new HttpError(400, "That day is already over");

  await useItem(req.userId, "day_off_card", "You don't have a Day Off card. Buy one in the Store.");
  await updateDay(day.id, { status: "day_off" });

  const note = await addNote(req.userId, "Used a Day Off card", day.id);
  res.json(await dayResponse(req.userId, day.id, note ? [note] : []));
});

// POST /days/:id/restart   (only today's plan, after it started or ended)
// Puts the day back to "planning" with no penalties AND no rewards:
// everything earned or lost today is undone, so restarting can't be used to farm XP.
router.post("/:id/restart", async (req, res) => {
  const day = await getDay(parseId(req.params.id), req.userId);
  const profile = await getProfile(req.userId);
  const changes: RewardEvent[] = [];

  if (day.date !== todayIn(profile.timezone)) throw new HttpError(400, "You can only restart today's plan");
  if (!["active", "done", "failed", "excused"].includes(day.status)) {
    throw new HttpError(400, "There's nothing to restart: this day hasn't started");
  }

  // 1. Undo today's XP and coins (gains AND penalties) with one opposite entry in the history.
  //    The old entries are unlinked from the day, so the daily cap starts fresh too.
  const { data: events, error } = await supabase.from("reward_events").select("id, xp, coins").eq("day_plan_id", day.id);
  if (error) throw error;
  const xpToday = events.reduce((sum, e) => sum + e.xp, 0);
  const coinsToday = events.reduce((sum, e) => sum + e.coins, 0);

  const { error: unlinkError } = await supabase.from("reward_events").update({ day_plan_id: null }).eq("day_plan_id", day.id);
  if (unlinkError) throw unlinkError;

  if (xpToday !== 0 || coinsToday !== 0) {
    const undo = { xp: -xpToday, coins: -coinsToday };
    record(changes, await changeRewards(req.userId, undo, "Restarted the day: today's rewards and penalties were undone", null));
  }

  // 2. Give back a Flexible Day card that was used to start it
  if (day.flexible_card_used) {
    await addItem(req.userId, "flexible_card");
    record(changes, await addNote(req.userId, "Flexible Day card returned (day restarted)"));
  }

  // 3. Every task back to "planned" (deleted tasks stay deleted)
  for (const task of await getTasks(day.id)) {
    if (task.status !== "planned") {
      await updateTask(task.id, { status: "planned", started_at: null, paused_seconds: 0, completed_at: null });
    }
  }

  // 4. Forget today's pauses (this also gives back today's emergency stops)
  const { error: pauseError } = await supabase.from("pause_events").delete().eq("day_plan_id", day.id);
  if (pauseError) throw pauseError;

  // 5. The day itself goes back to planning
  await updateDay(day.id, {
    status: "planning",
    started_at: null,
    paused_at: null,
    pause_type: null,
    total_paused_seconds: 0,
    regular_paused_seconds: 0,
    bonus_pause_seconds: 0,
    flexible_card_used: false,
  });

  res.json(await dayResponse(req.userId, day.id, changes));
});

// POST /days/:id/pause  { type: "pause" | "emergency" }
router.post("/:id/pause", async (req, res) => {
  const type = req.body.type === "emergency" ? "emergency" : "pause";
  const dayId = parseId(req.params.id);
  const changes: RewardEvent[] = [];

  let day = await getDay(dayId, req.userId);
  if (day.status !== "active") throw new HttpError(400, "The day isn't running");
  if (day.paused_at) throw new HttpError(400, "The day is already paused");

  // Make sure nothing already ran out BEFORE we freeze time
  await checkTimers(day, req.userId, changes);
  day = await getDay(dayId, req.userId);
  if (day.status !== "active") {
    res.json(await dayResponse(req.userId, dayId, changes));
    return;
  }

  if (type === "emergency" && (await emergencyStopsLeft(req.userId)) <= 0) {
    throw new HttpError(400, `You've used all ${RULES.emergencyStopsPerWeek} emergency stops this week`);
  }

  const now = nowIso();
  const { error } = await supabase
    .from("pause_events")
    .insert({ user_id: req.userId, day_plan_id: dayId, type, started_at: now });
  if (error) throw error;

  await updateDay(dayId, { paused_at: now, pause_type: type });
  res.json(await dayResponse(req.userId, dayId, changes));
});

// POST /days/:id/resume
router.post("/:id/resume", async (req, res) => {
  const day = await getDay(parseId(req.params.id), req.userId);
  if (!day.paused_at) throw new HttpError(400, "The day isn't paused");

  const changes: RewardEvent[] = [];
  await endPause(day, req.userId, changes);
  res.json(await dayResponse(req.userId, day.id, changes));
});

// POST /days/:id/check
// The frontend calls this when a countdown hits 0. The server decides what really happened.
router.post("/:id/check", async (req, res) => {
  const day = await getDay(parseId(req.params.id), req.userId);
  const changes: RewardEvent[] = [];
  await checkTimers(day, req.userId, changes);
  res.json(await dayResponse(req.userId, day.id, changes));
});

// POST /days/:id/finish   (the user ends the day early)
router.post("/:id/finish", async (req, res) => {
  let day = await getDay(parseId(req.params.id), req.userId);
  if (day.status !== "active") throw new HttpError(400, "The day isn't running");

  const changes: RewardEvent[] = [];

  if (day.pause_type === "emergency") {
    // Ending the day during an emergency: no penalty, no reward
    await closePauseEvents(day.id);
    await updateDay(day.id, { status: "excused", paused_at: null, pause_type: null });
  } else {
    day = await endPause(day, req.userId, changes);
    await finishDay(day, req.userId, changes);
  }

  res.json(await dayResponse(req.userId, day.id, changes));
});

// PUT /days/:id/order  { task_ids: [5, 2, 9] }   (only before the day starts)
// Saves the new order after you drag a task to a different spot.
router.put("/:id/order", async (req, res) => {
  const day = await getDay(parseId(req.params.id), req.userId);
  if (day.status !== "planning") throw new HttpError(400, "You can only reorder before the day starts");

  const tasks = await getTasks(day.id);
  const newOrder: number[] = Array.isArray(req.body.task_ids) ? req.body.task_ids.map(Number) : [];

  // The new order must contain exactly this day's tasks, each once
  const sameTasks =
    newOrder.length === tasks.length && new Set(newOrder).size === tasks.length && tasks.every((t) => newOrder.includes(t.id));
  if (!sameTasks) throw new HttpError(400, "The order doesn't match this day's tasks. Reload and try again.");

  for (const [index, taskId] of newOrder.entries()) {
    await updateTask(taskId, { position: index });
  }

  res.json(await dayResponse(req.userId, day.id));
});

// POST /days/:id/tasks  { title, details?, duration_minutes, is_break?, after_task_id? }
router.post("/:id/tasks", async (req, res) => {
  const day = await getDay(parseId(req.params.id), req.userId);

  await addTaskToDay(day, {
    title: req.body.title,
    details: req.body.details,
    durationMinutes: req.body.duration_minutes,
    isBreak: req.body.is_break,
    afterTaskId: req.body.after_task_id,
  });

  res.status(201).json(await dayResponse(req.userId, day.id));
});

export default router;
