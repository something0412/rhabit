import { Router } from "express";
import type { Note, TaskStatus } from "@productivity/shared";
import { supabase } from "../supabase";
import { HttpError, parseId } from "../httpError";

const router = Router();

async function getNote(noteId: number, userId: string): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Note not found");
  return data;
}

// Adds `task_status` to each note: what happened to the task it became (planned, completed, missed...)
async function withTaskStatus(notes: Note[]): Promise<Note[]> {
  const taskIds = notes.map((n) => n.task_id).filter((id): id is number => id !== null);
  const statusById = new Map<number, TaskStatus>();

  if (taskIds.length > 0) {
    const { data: tasks, error } = await supabase.from("tasks").select("id, status").in("id", taskIds);
    if (error) throw error;
    for (const task of tasks) statusById.set(task.id, task.status);
  }

  return notes.map((n) => ({ ...n, task_status: n.task_id !== null ? (statusById.get(n.task_id) ?? null) : null }));
}

// GET /notes  -> all your notes, newest first
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", req.userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  res.json(await withTaskStatus(data));
});

// POST /notes  { title, details? }
router.post("/", async (req, res) => {
  const title = String(req.body.title ?? "").trim();
  if (!title) throw new HttpError(400, "Note needs a title");

  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: req.userId, title, details: String(req.body.details ?? "").slice(0, 2000) })
    .select()
    .single();
  if (error) throw error;
  res.status(201).json((await withTaskStatus([data]))[0]);
});

// PATCH /notes/:id  { title?, details?, done?, in_bucket? }
router.patch("/:id", async (req, res) => {
  const note = await getNote(parseId(req.params.id), req.userId);
  const changes: Partial<Note> = {};

  if (req.body.title !== undefined) {
    const title = String(req.body.title).trim();
    if (!title) throw new HttpError(400, "Note needs a title");
    changes.title = title;
  }
  if (req.body.details !== undefined) changes.details = String(req.body.details).slice(0, 2000);
  if (req.body.done !== undefined) changes.done = Boolean(req.body.done);

  if (req.body.in_bucket !== undefined) {
    const intoBucket = Boolean(req.body.in_bucket);
    // A note can only become ONE task. Once it's assigned to a day, it can't go into the bucket again
    // (otherwise the same note could be added to plans over and over to farm XP).
    if (intoBucket && note.added_to_date) {
      throw new HttpError(400, `"${note.title}" is already assigned to the plan for ${note.added_to_date}`);
    }
    if (intoBucket && (note.done || changes.done)) throw new HttpError(400, "A finished note can't go into the bucket");
    changes.in_bucket = intoBucket;
  }

  // A finished note doesn't belong in the bucket
  if (changes.done) changes.in_bucket = false;

  const { data, error } = await supabase.from("notes").update(changes).eq("id", note.id).select().single();
  if (error) throw error;
  res.json((await withTaskStatus([data]))[0]);
});

// DELETE /notes/:id   (deleting a note never touches the task it became)
router.delete("/:id", async (req, res) => {
  const note = await getNote(parseId(req.params.id), req.userId);
  const { error } = await supabase.from("notes").delete().eq("id", note.id);
  if (error) throw error;
  res.json({ ok: true });
});

export default router;
