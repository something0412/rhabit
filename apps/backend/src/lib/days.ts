import type { DayPlan, DayResponse, RewardEvent, Task } from "@productivity/shared";
import { REWARDS, RULES, deadlineRemainingSeconds, taskRemainingSeconds } from "@productivity/shared";
import { supabase } from "../supabase";
import { HttpError } from "../httpError";
import { nowIso } from "./dates";
import { getInventory, useItem } from "./inventory";
import { getProfile, playerStatus } from "./player";
import { addNote, changeRewards } from "./rewards";

// Adds a reward change to the list (if anything actually changed)
export function record(changes: RewardEvent[], event: RewardEvent | null) {
  if (event) changes.push(event);
}

// ---------- reading & writing ----------

// Only returns the day if it belongs to this user (otherwise 404)
export async function getDay(dayId: number, userId: string): Promise<DayPlan> {
  const { data, error } = await supabase
    .from("day_plans")
    .select("*")
    .eq("id", dayId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Day plan not found");
  return data;
}

export async function getTasks(dayId: number): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("day_plan_id", dayId)
    .neq("status", "deleted")
    .order("position");
  if (error) throw error;
  return data;
}

// Loads a task AND its day, and checks the day belongs to this user
export async function getTaskAndDay(taskId: number, userId: string) {
  const { data: task, error } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (error) throw error;
  if (!task || task.status === "deleted") throw new HttpError(404, "Task not found");

  const day = await getDay(task.day_plan_id, userId);
  return { task: task as Task, day };
}

export async function updateDay(dayId: number, changes: Partial<DayPlan>): Promise<DayPlan> {
  const { data, error } = await supabase.from("day_plans").update(changes).eq("id", dayId).select().single();
  if (error) throw error;
  return data;
}

export async function updateTask(taskId: number, changes: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase.from("tasks").update(changes).eq("id", taskId).select().single();
  if (error) throw error;
  return data;
}

// What every /days and /tasks endpoint sends back to the frontend
export async function dayResponse(
  userId: string,
  dayId: number,
  rewardChanges: RewardEvent[] = []
): Promise<DayResponse> {
  const day = await getDay(dayId, userId);
  const tasks = await getTasks(dayId);
  const profile = await getProfile(userId);
  const status = await playerStatus(profile);
  return { day, tasks, profile, status, reward_changes: rewardChanges };
}

export async function emergencyStopsLeft(userId: string): Promise<number> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("pause_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "emergency")
    .gte("started_at", oneWeekAgo);
  if (error) throw error;
  return Math.max(0, RULES.emergencyStopsPerWeek - (count ?? 0));
}

export async function closePauseEvents(dayId: number) {
  const { error } = await supabase
    .from("pause_events")
    .update({ ended_at: nowIso() })
    .eq("day_plan_id", dayId)
    .is("ended_at", null);
  if (error) throw error;
}

// ---------- day logic ----------

interface NewTask {
  title: unknown;
  details?: unknown;
  durationMinutes: unknown;
  isBreak?: unknown;
  afterTaskId?: unknown; // insert right after this task (used by the break suggestion)
  insertAt?: unknown; // insert at this spot in the list: 0 = first (used when dropping from the bucket)
}

// Checks a task's minutes. Timer mode NEEDS minutes (each task has a countdown).
// Deadline and flexible mode don't: empty means "no time set" (null).
export function readDuration(value: unknown, mode: DayPlan["mode"]): number | null {
  const empty = value === undefined || value === null || value === "";
  if (empty) {
    if (mode === "timer") throw new HttpError(400, "In timer mode every task needs minutes");
    return null;
  }

  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 24 * 60) {
    throw new HttpError(400, "Duration must be between 1 and 1440 minutes");
  }
  return minutes;
}

// Adds a task to a day. Used by the "Add" form AND by dragging from the bucket.
// Returns the new task's id.
export async function addTaskToDay(day: DayPlan, input: NewTask): Promise<number> {
  if (day.status !== "planning" && day.status !== "active") throw new HttpError(400, "This day is already over");

  const title = String(input.title ?? "").trim();
  const details = String(input.details ?? "").slice(0, 2000);
  const isBreak = Boolean(input.isBreak);

  if (!title) throw new HttpError(400, "Task needs a title");
  const durationMinutes = readDuration(input.durationMinutes, day.mode);

  const tasks = await getTasks(day.id);
  let position = tasks.length > 0 ? Math.max(...tasks.map((t) => t.position)) + 1 : 0; // default: at the end

  // Where in the list should it go? (index 0 = first)
  let index = tasks.length;
  if (input.afterTaskId) {
    const afterIndex = tasks.findIndex((t) => t.id === Number(input.afterTaskId));
    if (afterIndex === -1) throw new HttpError(404, "Task not found");
    index = afterIndex + 1;
  } else if (input.insertAt !== undefined && input.insertAt !== null) {
    index = Math.max(0, Math.min(tasks.length, Math.floor(Number(input.insertAt)) || 0));
  }

  // Not at the end: take that spot and shift everything from there down by one
  if (index < tasks.length) {
    position = tasks[index].position;
    for (const t of tasks.slice(index)) {
      await updateTask(t.id, { position: t.position + 1 });
    }
  }

  const { data: created, error } = await supabase
    .from("tasks")
    .insert({
      day_plan_id: day.id,
      title,
      details,
      duration_minutes: durationMinutes,
      is_break: isBreak,
      position,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Adding a task mid-day is free. In timer mode, start it if nothing is running.
  if (day.status === "active" && !day.paused_at) await startNextTask(day);

  return created.id;
}

// When a task is deleted, whatever it came from goes back where it was:
//  - a note goes back to the Notes list (no longer "assigned")
//  - a scheduled task goes back into the bucket
// (This is safe from farming: deleting after the day starts costs XP/coins.)
export async function releaseTaskSources(taskId: number) {
  const { error } = await supabase.from("notes").update({ added_to_date: null, task_id: null }).eq("task_id", taskId);
  if (error) throw error;

  const { error: scheduledError } = await supabase
    .from("scheduled_tasks")
    .update({ status: "scheduled", task_id: null })
    .eq("task_id", taskId);
  if (scheduledError) throw scheduledError;
}

// Timer mode only: tasks run one after another, so start the next planned one.
// `startAt` lets a task start exactly when the previous one ran out.
export async function startNextTask(day: DayPlan, startAt: string = nowIso()) {
  if (day.mode !== "timer") return;

  const tasks = await getTasks(day.id);
  if (tasks.some((t) => t.status === "running")) return;

  const next = tasks.find((t) => t.status === "planned");
  if (next) {
    await updateTask(next.id, { status: "running", started_at: startAt, paused_seconds: 0 });
  }
}

// Ends the day: unfinished tasks become "missed", then decide done/failed + bonus.
export async function finishDay(day: DayPlan, userId: string, changes: RewardEvent[]) {
  const penalize = day.mode !== "flexible" || RULES.flexibleModePenalties;
  const tasks = await getTasks(day.id);

  for (const task of tasks) {
    if (task.status !== "planned" && task.status !== "running") continue;

    if (task.is_break) {
      // an unfinished break doesn't matter
      await updateTask(task.id, { status: "completed", completed_at: nowIso() });
      continue;
    }

    await updateTask(task.id, { status: "missed" });
    if (penalize) {
      record(changes, await changeRewards(userId, REWARDS.missTask, `Missed "${task.title}"`, day.id, task.id));
    }
  }

  const realTasks = (await getTasks(day.id)).filter((t) => !t.is_break);
  const allDone = realTasks.length > 0 && realTasks.every((t) => t.status === "completed");

  if (allDone) {
    record(changes, await changeRewards(userId, REWARDS.fullDayBonus, "Completed the whole day", day.id));
  }

  await closePauseEvents(day.id);
  await updateDay(day.id, { status: allDone ? "done" : "failed", paused_at: null, pause_type: null });
}

// If no tasks are left to do, the day is over.
export async function finishDayIfDone(day: DayPlan, userId: string, changes: RewardEvent[]) {
  const tasks = await getTasks(day.id);
  const anythingLeft = tasks.some((t) => t.status === "planned" || t.status === "running");
  if (!anythingLeft) await finishDay(day, userId, changes);
}

// Resume after a pause / emergency stop.
// Adds the paused time to the running task (so its timer is frozen correctly).
// Normal pauses over the free daily allowance use Pause Pack cards first, then cost XP/coins.
export async function endPause(day: DayPlan, userId: string, changes: RewardEvent[]): Promise<DayPlan> {
  if (!day.paused_at) return day;

  const now = Date.now();
  const pausedSeconds = Math.round((now - Date.parse(day.paused_at)) / 1000);

  const running = (await getTasks(day.id)).find((t) => t.status === "running");
  if (running?.started_at) {
    const pauseStart = Math.max(Date.parse(day.paused_at), Date.parse(running.started_at));
    await updateTask(running.id, {
      paused_seconds: running.paused_seconds + Math.round((now - pauseStart) / 1000),
    });
  }

  let regularPaused = day.regular_paused_seconds;
  let bonusPause = day.bonus_pause_seconds;

  if (day.pause_type === "pause") {
    const freeSeconds = () => RULES.freePauseMinutesPerDay * 60 + bonusPause;
    const blocksBefore = Math.floor(Math.max(0, regularPaused - freeSeconds()) / 600);
    regularPaused += pausedSeconds;

    // Went over the free time? Use Pause Pack cards automatically, one at a time.
    let pauseCards = (await getInventory(userId)).pause_card ?? 0;
    while (pauseCards > 0 && regularPaused > freeSeconds()) {
      await useItem(userId, "pause_card", "No Pause Pack cards left");
      pauseCards--;
      bonusPause += RULES.pauseCardMinutes * 60;
      record(changes, await addNote(userId, `Used a Pause Pack (+${RULES.pauseCardMinutes} min free pause)`, day.id));
    }

    const blocksAfter = Math.floor(Math.max(0, regularPaused - freeSeconds()) / 600);
    const newBlocks = blocksAfter - blocksBefore; // each 10 min over the allowance
    if (newBlocks > 0) {
      const penalty = {
        xp: REWARDS.overPausePer10Min.xp * newBlocks,
        coins: REWARDS.overPausePer10Min.coins * newBlocks,
      };
      record(changes, await changeRewards(userId, penalty, `Paused ${newBlocks * 10} min over the daily allowance`, day.id));
    }
  }

  await closePauseEvents(day.id);
  return updateDay(day.id, {
    paused_at: null,
    pause_type: null,
    total_paused_seconds: day.total_paused_seconds + pausedSeconds,
    regular_paused_seconds: regularPaused,
    bonus_pause_seconds: bonusPause,
  });
}

// The server double-checks the timers (the frontend can't be trusted for rewards).
//  - timer mode: a running task whose time ran out becomes "missed" (breaks just end)
//  - deadline mode: once the deadline passes, the day ends
export async function checkTimers(day: DayPlan, userId: string, changes: RewardEvent[]) {
  if (day.status !== "active" || day.paused_at) return;

  if (day.mode === "timer") {
    // A loop, because several tasks may have run out while the user was away
    while (true) {
      const running = (await getTasks(day.id)).find((t) => t.status === "running");
      if (!running || !running.started_at || taskRemainingSeconds(running, day) > 0) break;

      const ranOutAt = new Date(
        Date.parse(running.started_at) + ((running.duration_minutes ?? 0) * 60 + running.paused_seconds) * 1000
      ).toISOString();

      if (running.is_break) {
        await updateTask(running.id, { status: "completed", completed_at: ranOutAt });
      } else {
        await updateTask(running.id, { status: "missed" });
        record(
          changes,
          await changeRewards(userId, REWARDS.missTask, `Ran out of time on "${running.title}"`, day.id, running.id)
        );
      }

      await startNextTask(day, ranOutAt);
    }
    await finishDayIfDone(day, userId, changes);
  }

  if (day.mode === "deadline" && deadlineRemainingSeconds(day) === 0) {
    await finishDay(day, userId, changes);
  }
}

// Days from the past get closed out the next time the user opens the app:
//  - started but never finished -> unfinished tasks are missed
//  - planned tasks but never started (and no Day Off card used) -> also missed
//  - nothing planned -> left alone, no penalty
//  - ended during an emergency stop -> excused
export async function closeOldDays(userId: string, today: string): Promise<RewardEvent[]> {
  const { data: oldDays, error } = await supabase
    .from("day_plans")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "planning"])
    .lt("date", today);
  if (error) throw error;

  const changes: RewardEvent[] = [];
  for (const day of oldDays as DayPlan[]) {
    if (day.pause_type === "emergency") {
      await closePauseEvents(day.id);
      await updateDay(day.id, { status: "excused", paused_at: null, pause_type: null });
      continue;
    }

    if (day.status === "planning") {
      const plannedRealTasks = (await getTasks(day.id)).filter((t) => !t.is_break);
      if (plannedRealTasks.length === 0) continue; // nothing was planned
    }

    await finishDay(day, userId, changes);
  }
  return changes;
}
