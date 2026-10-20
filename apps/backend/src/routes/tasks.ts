import { Router } from "express";
import type { RewardEvent } from "@productivity/shared";
import { REWARDS, RULES, deadlineRemainingSeconds, taskRemainingSeconds } from "@productivity/shared";
import { supabase } from "../supabase";
import { HttpError, parseId } from "../httpError";
import { nowIso } from "../lib/dates";
import { useItem } from "../lib/inventory";
import { addNote, changeRewards } from "../lib/rewards";
import {
  checkTimers,
  dayResponse,
  finishDayIfDone,
  getDay,
  getTaskAndDay,
  getTasks,
  readDuration,
  releaseTaskSources,
  record,
  startNextTask,
  updateTask,
} from "../lib/days";

const router = Router();

// PATCH /tasks/:id  { title?, duration_minutes?, details? }
// Free: renaming, shortening. Costs XP/coins: making a timer LONGER after the day started.
router.patch("/:id", async (req, res) => {
  const { task, day } = await getTaskAndDay(parseId(req.params.id), req.userId);

  // Only changing the dropdown details: always allowed and always free
  if (req.body.details !== undefined && req.body.title === undefined && req.body.duration_minutes === undefined) {
    await updateTask(task.id, { details: String(req.body.details).slice(0, 2000) });
    res.json(await dayResponse(req.userId, day.id));
    return;
  }

  if (day.status !== "planning" && day.status !== "active") throw new HttpError(400, "This day is already over");
  if (task.status !== "planned" && task.status !== "running") throw new HttpError(400, "Finished tasks can't be edited");

  const title = req.body.title !== undefined ? String(req.body.title).trim() : task.title;
  const durationMinutes =
    req.body.duration_minutes !== undefined ? readDuration(req.body.duration_minutes, day.mode) : task.duration_minutes;

  if (!title) throw new HttpError(400, "Task needs a title");

  const changes: RewardEvent[] = [];

  // Only timer mode has countdowns, so only there does a longer timer cost something
  const oldMinutes = task.duration_minutes ?? 0;
  const newMinutes = durationMinutes ?? 0;
  if (day.status === "active" && day.mode === "timer" && newMinutes > oldMinutes && !task.is_break) {
    const reason = `Extended "${task.title}" by ${newMinutes - oldMinutes} min`;
    record(changes, await changeRewards(req.userId, REWARDS.extendTimer, reason, day.id, task.id));
  }

  await updateTask(task.id, { title, duration_minutes: durationMinutes });

  // Shortening a running task might mean its time is already up
  await checkTimers(await getDay(day.id, req.userId), req.userId, changes);

  res.json(await dayResponse(req.userId, day.id, changes));
});

// DELETE /tasks/:id            (after the day starts this costs XP/coins, except breaks)
// DELETE /tasks/:id?use_card=true   (uses a Delete card instead: no penalty)
router.delete("/:id", async (req, res) => {
  const { task, day } = await getTaskAndDay(parseId(req.params.id), req.userId);
  const changes: RewardEvent[] = [];

  if (day.status === "planning") {
    await releaseTaskSources(task.id); // the note / scheduled task it came from goes back
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) throw error;
    res.json(await dayResponse(req.userId, day.id));
    return;
  }

  if (day.status !== "active") throw new HttpError(400, "This day is already over");
  if (task.status !== "planned" && task.status !== "running") throw new HttpError(400, "Finished tasks can't be deleted");

  if (!task.is_break) {
    if (req.query.use_card === "true") {
      await useItem(req.userId, "delete_card", "You don't have a Delete card. Buy one in the Store.");
      record(changes, await addNote(req.userId, `Used a Delete card on "${task.title}"`, day.id, task.id));
    } else {
      const reason = `Deleted "${task.title}" after the day started`;
      record(changes, await changeRewards(req.userId, REWARDS.deleteTask, reason, day.id, task.id));
    }
  }

  await updateTask(task.id, { status: "deleted" });
  await releaseTaskSources(task.id); // the note / scheduled task it came from goes back
  await startNextTask(day); // if we deleted the running task, start the next one
  await finishDayIfDone(day, req.userId, changes);

  res.json(await dayResponse(req.userId, day.id, changes));
});

// POST /tasks/:id/complete
router.post("/:id/complete", async (req, res) => {
  const { task, day } = await getTaskAndDay(parseId(req.params.id), req.userId);
  const changes: RewardEvent[] = [];

  if (day.status !== "active") throw new HttpError(400, "Start the day first");
  if (day.paused_at) throw new HttpError(400, "Resume the day first");
  if (task.status !== "planned" && task.status !== "running") throw new HttpError(400, "This task is already finished");
  if (day.mode === "timer" && task.status !== "running") {
    throw new HttpError(400, "In timer mode, tasks go in order. Finish the current one first");
  }

  // Too late? Let the server's timer check decide instead.
  const timeIsUp =
    (day.mode === "timer" && taskRemainingSeconds(task, day) === 0) ||
    (day.mode === "deadline" && deadlineRemainingSeconds(day) === 0);
  if (timeIsUp) {
    await checkTimers(day, req.userId, changes);
    res.json(await dayResponse(req.userId, day.id, changes));
    return;
  }

  await updateTask(task.id, { status: "completed", completed_at: nowIso() });

  // Breaks and very short tasks don't earn anything (anti-farming).
  // Tasks with no time set (deadline/flexible mode) do earn: the deadline keeps them honest.
  const tooShort = task.duration_minutes !== null && task.duration_minutes < RULES.minMinutesForRewards;
  if (!task.is_break && !tooShort) {
    record(changes, await changeRewards(req.userId, REWARDS.completeTask, `Completed "${task.title}"`, day.id, task.id));
  }

  await startNextTask(day);
  await finishDayIfDone(day, req.userId, changes);

  res.json(await dayResponse(req.userId, day.id, changes));
});

export default router;
