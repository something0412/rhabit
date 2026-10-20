import type { DayPlan, Task } from "./types";

// Timers are NOT counted down on the server.
// We only save timestamps, and calculate the remaining time from them.
// The frontend uses these to show the countdown; the backend uses the same
// functions to check if time really ran out.

// While the day is paused, time is "frozen" at the moment the pause started.
function effectiveNow(day: DayPlan, now: number): number {
  return day.paused_at ? Date.parse(day.paused_at) : now;
}

export function taskRemainingSeconds(task: Task, day: DayPlan, now: number = Date.now()): number {
  // (only timer mode has per-task timers, and there every task has minutes)
  const totalSeconds = (task.duration_minutes ?? 0) * 60;
  if (!task.started_at) return totalSeconds;

  // (Math.max handles a task that started while the day was already paused)
  const end = Math.max(effectiveNow(day, now), Date.parse(task.started_at));
  const elapsedSeconds = (end - Date.parse(task.started_at)) / 1000 - task.paused_seconds;

  return Math.max(0, Math.round(totalSeconds - elapsedSeconds));
}

// Pauses push the deadline back by however long the day was paused.
export function deadlineRemainingSeconds(day: DayPlan, now: number = Date.now()): number | null {
  if (!day.deadline_at) return null;

  const deadline = Date.parse(day.deadline_at) + day.total_paused_seconds * 1000;
  return Math.max(0, Math.round((deadline - effectiveNow(day, now)) / 1000));
}

// 3725 -> "1:02:05", 125 -> "2:05"
export function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
