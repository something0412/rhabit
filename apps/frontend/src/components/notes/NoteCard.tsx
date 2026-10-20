"use client";

import { useState } from "react";
import type { Note, TaskStatus } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { clearDragData, setDragData } from "@/lib/dragData";
import { prettyDate } from "@/lib/dates";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { DetailsArrow, DetailsBox } from "@/components/common/Details";

// What happened to the task this note became
const taskStatusStyles: Record<TaskStatus, string> = {
  planned: "bg-subtle text-muted",
  running: "bg-accent-soft text-accent-ink",
  completed: "bg-emerald-500/15 text-emerald-700",
  missed: "bg-red-500/15 text-red-600",
  deleted: "bg-subtle text-muted",
};

interface Props {
  note: Note;
  onChanged: (note: Note) => void;
  onDeleted: (noteId: number) => void;
}

// One note on the Notes tab. Unfinished notes can be dragged into the bucket.
export function NoteCard({ note, onChanged, onDeleted }: Props) {
  const { notify } = useNotifications();
  const [showDetails, setShowDetails] = useState(false);

  async function toggleDone() {
    try {
      const res = await api.patch<Note>(`/notes/${note.id}`, { done: !note.done });
      onChanged(res.data);
    } catch (error) {
      notify("danger", "Couldn't update note", errorMessage(error));
    }
  }

  async function saveDetails(details: string) {
    try {
      const res = await api.patch<Note>(`/notes/${note.id}`, { details });
      onChanged(res.data);
    } catch (error) {
      notify("danger", "Couldn't save details", errorMessage(error));
    }
  }

  async function deleteNote() {
    if (!window.confirm(`Delete "${note.title}"?`)) return;
    try {
      await api.delete(`/notes/${note.id}`);
      onDeleted(note.id);
    } catch (error) {
      notify("danger", "Couldn't delete note", errorMessage(error));
    }
  }

  // Assigned = already became a task in a day's plan. It can't be dragged into the bucket again.
  const assigned = note.added_to_date !== null;
  const canDrag = !note.done && !assigned && !showDetails;

  return (
    <li
      draggable={canDrag}
      onDragStart={(e) => setDragData(e, { kind: "note", id: note.id })}
      onDragEnd={clearDragData}
      className={`rounded-lg border border-line bg-surface p-3 ${note.done ? "opacity-60" : ""} ${
        canDrag ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={note.done}
          onChange={toggleDone}
          aria-label={note.done ? "Mark as not done" : "Mark as done"}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        <DetailsArrow open={showDetails} hasDetails={note.details !== ""} onToggle={() => setShowDetails(!showDetails)} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm ${note.done ? "text-muted line-through" : "font-medium"}`}>{note.title}</p>
          {note.added_to_date && (
            <p className="text-[11px] text-muted">
              Plan for {prettyDate(note.added_to_date)}
              {note.task_status && (
                <span className={`ml-1.5 rounded px-1.5 py-px capitalize ${taskStatusStyles[note.task_status]}`}>
                  {note.task_status}
                </span>
              )}
            </p>
          )}
        </div>
        <button onClick={deleteNote} className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-500/10">
          Delete
        </button>
      </div>

      {showDetails && <DetailsBox value={note.details} onSave={saveDetails} />}
    </li>
  );
}
