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

// The deadline right now: the time the user set + however much emergency stops moved it.
// (Deadline mode has no Pause. While an emergency stop is on, the countdown is frozen; when the user
// presses Continue, the stopped time, rounded up to the hour, is added to deadline_extra_seconds.)
export function currentDeadline(day: DayPlan): number | null {
  if (!day.deadline_at) return null;
  return Date.parse(day.deadline_at) + day.deadline_extra_seconds * 1000;
}

export function deadlineRemainingSeconds(day: DayPlan, now: number = Date.now()): number | null {
  const deadline = currentDeadline(day);
  if (deadline === null) return null;
  return Math.max(0, Math.round((deadline - effectiveNow(day, now)) / 1000));
}

// Flexible mode's count-up timer: time spent while there were tasks left to do.
// It runs from Start day until every task is done, and starts again if a new task is added that day.
export function flexibleWorkSeconds(day: DayPlan, now: number = Date.now()): number {
  const runningFor = day.work_running_since ? Math.max(0, (now - Date.parse(day.work_running_since)) / 1000) : 0;
  return Math.round(day.work_seconds + runningFor);
}

// 5400 -> "1 h 30 min", 3600 -> "1 h", 1800 -> "30 min"   (for durations like "deadline moved 1 h 30 min")
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// 3725 -> "1:02:05", 125 -> "2:05"
export function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
