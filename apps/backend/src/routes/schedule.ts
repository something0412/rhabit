import { Router } from "express";
import type { ScheduledTask } from "@productivity/shared";
import { supabase } from "../supabase";
import { HttpError, parseId } from "../httpError";

const router = Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/; // "2026-10-20"
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/; // "14:30"

async function getScheduledTask(id: number, userId: string): Promise<ScheduledTask> {
  const { data, error } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Scheduled task not found");
  return data;
}

// Checks the fields that both POST and PATCH accept. Only includes the ones that were sent.
function readFields(body: Record<string, unknown>) {
  const fields: Partial<ScheduledTask> = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) throw new HttpError(400, "Task needs a title");
    fields.title = title;
  }
  if (body.details !== undefined) fields.details = String(body.details).slice(0, 2000);
  if (body.date !== undefined) {
    if (!DATE_PATTERN.test(String(body.date))) throw new HttpError(400, "Pick a date");
    fields.date = String(body.date);
  }
  if (body.time !== undefined) {
    if (body.time !== null && !TIME_PATTERN.test(String(body.time))) throw new HttpError(400, "Times must look like 14:30");
    fields.time = body.time === null ? null : String(body.time);
  }
  if (body.duration_minutes !== undefined) {
    const minutes = body.duration_minutes === null ? null : Number(body.duration_minutes);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 24 * 60)) {
      throw new HttpError(400, "Duration must be between 1 and 1440 minutes");
    }
    fields.duration_minutes = minutes;
  }
  return fields;
}

// GET /schedule  -> everything you scheduled, soonest first
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("scheduled_tasks")
    .select("*")
    .eq("user_id", req.userId)
    .order("date");
  if (error) throw error;
  res.json(data);
});

// POST /schedule  { title, date, details?, time?, duration_minutes? }
router.post("/", async (req, res) => {
  const fields = readFields(req.body);
  if (!fields.title) throw new HttpError(400, "Task needs a title");
  if (!fields.date) throw new HttpError(400, "Pick a date");

  const { data, error } = await supabase
    .from("scheduled_tasks")
    .insert({ user_id: req.userId, ...fields })
    .select()
    .single();
  if (error) throw error;
  res.status(201).json(data);
});

// PATCH /schedule/:id  { title?, date?, details?, time?, duration_minutes? }
router.patch("/:id", async (req, res) => {
  const task = await getScheduledTask(parseId(req.params.id), req.userId);
  const fields = readFields(req.body);

  // Moving it to a new date puts it back on the schedule
  if (fields.date && fields.date !== task.date) fields.status = "scheduled";

  const { data, error } = await supabase.from("scheduled_tasks").update(fields).eq("id", task.id).select().single();
  if (error) throw error;
  res.json(data);
});

// DELETE /schedule/:id
router.delete("/:id", async (req, res) => {
  const task = await getScheduledTask(parseId(req.params.id), req.userId);
  const { error } = await supabase.from("scheduled_tasks").delete().eq("id", task.id);
  if (error) throw error;
  res.json({ ok: true });
});

export default router;
