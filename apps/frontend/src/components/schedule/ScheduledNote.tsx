"use client";

import { useState } from "react";
import type { ScheduledStatus, ScheduledTask } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { prettyTime } from "@/lib/dates";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { DetailsArrow, DetailsBox } from "@/components/common/Details";

// Sticky-note paper colors (the card picks one by its id, so it always keeps the same color)
const PAPER = [
  { paper: "#fef3a0", header: "#f6e05e" }, // yellow
  { paper: "#fbd5e3", header: "#f5a8c5" }, // pink
  { paper: "#cfe8fb", header: "#9fd0f5" }, // blue
  { paper: "#d4f2d0", header: "#a7e3a0" }, // green
  { paper: "#ffe1bf", header: "#ffc187" }, // orange
];

// A slight, random-looking tilt, also picked by id
const TILT = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "rotate-0"];

const statusLabels: Record<ScheduledStatus, string> = {
  scheduled: "Scheduled",
  added: "✓ Added to plan",
  dismissed: "Ignored",
};

interface Props {
  task: ScheduledTask;
  today: string;
  onChanged: (task: ScheduledTask) => void;
  onDeleted: (id: number) => void;
}

// One scheduled task, drawn as a sticky note with a tear-off calendar page on top.
export function ScheduledNote({ task, today, onChanged, onDeleted }: Props) {
  const { notify } = useNotifications();
  const [showDetails, setShowDetails] = useState(false);

  const color = PAPER[task.id % PAPER.length];
  const tilt = TILT[task.id % TILT.length];
  const date = new Date(`${task.date}T12:00:00`);
  const isToday = task.date === today;
  const handled = task.status !== "scheduled";

  async function saveDetails(details: string) {
    try {
      const res = await api.patch<ScheduledTask>(`/schedule/${task.id}`, { details });
      onChanged(res.data);
    } catch (error) {
      notify("danger", "Couldn't save details", errorMessage(error));
    }
  }

  async function deleteTask() {
    if (!window.confirm(`Delete "${task.title}" from your schedule?`)) return;
    try {
      await api.delete(`/schedule/${task.id}`);
      onDeleted(task.id);
    } catch (error) {
      notify("danger", "Couldn't delete it", errorMessage(error));
    }
  }

  return (
    <li
      // The note sets its OWN colors (dark text on light paper), so it looks right in every theme
      style={
        {
          background: color.paper,
          "--ink": "#3a3222",
          "--muted": "#6e6348",
          "--subtle": "rgba(255, 255, 255, 0.55)",
          "--line": "rgba(0, 0, 0, 0.15)",
          "--accent": "#5b4b2a",
        } as React.CSSProperties
      }
      className={`group relative flex min-h-60 flex-col rounded-sm text-ink shadow-[0_6px_14px_rgba(0,0,0,0.15)] transition hover:z-10 hover:rotate-0 hover:shadow-[0_10px_22px_rgba(0,0,0,0.22)] ${tilt} ${
        handled ? "opacity-60" : ""
      }`}
    >
      {/* a strip of tape holding the note up */}
      <span aria-hidden className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-3 bg-white/60 shadow-sm" />

      {/* the tear-off calendar page */}
      <div className="rounded-t-sm px-3 pt-4 pb-2 text-center" style={{ background: color.header }}>
        <p className="text-[11px] font-bold tracking-[0.2em] uppercase">
          {date.toLocaleDateString([], { month: "short" })}
          {isToday && " · Today"}
        </p>
        <p className="text-4xl leading-none font-black">{date.getDate()}</p>
        <p className="text-xs font-medium">{date.toLocaleDateString([], { weekday: "long" })}</p>
      </div>
      <div aria-hidden className="border-t-2 border-dashed border-black/20" />

      {/* what's on it */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-sm leading-snug font-semibold break-words">{task.title}</p>
        <p className="text-xs text-muted">
          {task.time ? prettyTime(task.time) : "Any time"}
          {task.duration_minutes && ` · ${task.duration_minutes} min`}
        </p>

        {showDetails && <DetailsBox value={task.details} onSave={saveDetails} />}

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-1">
            <DetailsArrow open={showDetails} hasDetails={task.details !== ""} onToggle={() => setShowDetails(!showDetails)} />
            <span className="text-[11px] font-medium text-muted">{statusLabels[task.status]}</span>
          </div>
          <button
            onClick={deleteTask}
            aria-label={`Delete ${task.title}`}
            className="rounded px-1.5 text-lg leading-none text-muted opacity-0 transition group-hover:opacity-100 hover:text-red-700 focus:opacity-100"
          >
            ×
          </button>
        </div>
      </div>
    </li>
  );
}
