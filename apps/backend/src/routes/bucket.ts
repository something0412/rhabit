import { Router } from "express";
import type { AddFromBucketResponse, BucketItem, Note, ScheduledTask, Task } from "@productivity/shared";
import { RULES } from "@productivity/shared";
import { supabase } from "../supabase";
import { HttpError, parseId } from "../httpError";
import { addDays, todayIn } from "../lib/dates";
import { getProfile } from "../lib/player";
import { addTaskToDay, dayResponse, getDay } from "../lib/days";

// The to-do bucket holds three kinds of things:
//  - notes you dragged into it (Notes tab)
//  - scheduled tasks whose date has come (Scheduler tab), for up to 7 days after their date
//  - missed tasks from the last 7 days ("From previous days"), so you can try them again
// From the Main tab you can drag them into your day's plan. Past things drop out after 7 days.

const router = Router();

async function getBucket(userId: string): Promise<BucketItem[]> {
  const profile = await getProfile(userId);
  const today = todayIn(profile.timezone);
  const oldest = addDays(today, -RULES.bucketPastDays); // anything older than this has dropped out

  const { data: notes, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .eq("in_bucket", true)
    .eq("done", false)
    .is("added_to_date", null) // already assigned to a day = never in the bucket again
    .order("created_at");
  if (error) throw error;

  // Due today, or earlier and never handled
  const { data: scheduled, error: scheduledError } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .lte("date", today)
    .gte("date", oldest)
    .order("date");
  if (scheduledError) throw scheduledError;

  const fromSchedule: BucketItem[] = (scheduled as ScheduledTask[]).map((s) => ({
    source: "scheduled",
    id: s.id,
    title: s.title,
    details: s.details,
    duration_minutes: s.duration_minutes,
    date: s.date,
    time: s.time,
  }));

  const fromNotes: BucketItem[] = (notes as Note[]).map((n) => ({
    source: "note",
    id: n.id,
    title: n.title,
    details: n.details,
    duration_minutes: null,
    date: null,
    time: null,
  }));

  // Missed tasks from the last 7 days (not today), not taken out of the bucket yet
  const { data: pastDays, error: daysError } = await supabase
    .from("day_plans")
    .select("id, date")
    .eq("user_id", userId)
    .lt("date", today)
    .gte("date", oldest);
  if (daysError) throw daysError;

  let fromMissed: BucketItem[] = [];
  if (pastDays.length > 0) {
    const dateOfDay = new Map<number, string>(pastDays.map((d) => [d.id, d.date]));
    const { data: missed, error: missedError } = await supabase
      .from("tasks")
      .select("*")
      .in("day_plan_id", [...dateOfDay.keys()])
      .eq("status", "missed")
      .eq("is_break", false)
      .eq("bucket_done", false);
    if (missedError) throw missedError;

    fromMissed = (missed as Task[])
      .map((t) => ({
        source: "missed" as const,
        id: t.id,
        title: t.title,
        details: t.details,
        duration_minutes: t.duration_minutes,
        date: dateOfDay.get(t.day_plan_id) ?? null, // the day it was missed
        time: null,
      }))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")); // most recent first
  }

  return [...fromSchedule, ...fromMissed, ...fromNotes];
}

// Finds a bucket item and checks it belongs to this user
async function getBucketItem(userId: string, source: unknown, id: number): Promise<BucketItem> {
  const item = (await getBucket(userId)).find((i) => i.source === source && i.id === id);
  if (!item) throw new HttpError(404, "That item isn't in your bucket");
  return item;
}

// Takes an item out of the bucket.
//  - added to a plan (addedTo given): the note becomes "assigned" / the scheduled task becomes "added" /
//    the missed task is marked done in the bucket, and all remember which task they became
//  - just removed: the note goes back to the Notes list / the scheduled task is "dismissed" /
//    the missed task is marked done in the bucket (it stays missed, its penalty already happened)
async function removeFromBucket(item: BucketItem, addedTo: { date: string; taskId: number } | null) {
  if (item.source === "note") {
    const changes = addedTo ? { in_bucket: false, added_to_date: addedTo.date, task_id: addedTo.taskId } : { in_bucket: false };
    const { error } = await supabase.from("notes").update(changes).eq("id", item.id);
    if (error) throw error;
  } else if (item.source === "scheduled") {
    const changes = addedTo ? { status: "added", task_id: addedTo.taskId } : { status: "dismissed" };
    const { error } = await supabase.from("scheduled_tasks").update(changes).eq("id", item.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("tasks")
      .update({ bucket_done: true, redo_task_id: addedTo ? addedTo.taskId : null })
      .eq("id", item.id);
    if (error) throw error;
  }
}

// GET /bucket
router.get("/", async (req, res) => {
  res.json(await getBucket(req.userId));
});

// POST /bucket/add-to-day  { source, id, day_id, duration_minutes, insert_at? }
// Turns a bucket item into a real task in that day's plan (its details come along).
router.post("/add-to-day", async (req, res) => {
  const item = await getBucketItem(req.userId, req.body.source, Number(req.body.id));
  const day = await getDay(parseId(String(req.body.day_id)), req.userId);

  const taskId = await addTaskToDay(day, {
    title: item.title,
    details: item.details,
    durationMinutes: req.body.duration_minutes,
    insertAt: req.body.insert_at, // where in the list it was dropped (missing = at the end)
  });
  await removeFromBucket(item, { date: day.date, taskId });

  const body: AddFromBucketResponse = {
    day: await dayResponse(req.userId, day.id),
    bucket: await getBucket(req.userId),
  };
  res.json(body);
});

// POST /bucket/remove  { source, id }   (ignore it: note goes back to the list, scheduled task is dismissed)
router.post("/remove", async (req, res) => {
  const item = await getBucketItem(req.userId, req.body.source, Number(req.body.id));
  await removeFromBucket(item, null);
  res.json(await getBucket(req.userId));
});

export default router;
