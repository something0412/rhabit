"use client";

import { useState } from "react";
import type { DayResponse, Task, TaskStatus } from "@productivity/shared";
import { REWARDS, formatSeconds, taskRemainingSeconds } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { formatReward } from "@/lib/rewards";
import { setDragData } from "@/lib/dragData";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { DetailsArrow, DetailsBox } from "@/components/common/Details";

const statusStyles: Record<TaskStatus, string> = {
  planned: "bg-subtle text-muted",
  running: "bg-accent-soft text-accent-ink",
  completed: "bg-emerald-500/15 text-emerald-700",
  missed: "bg-red-500/15 text-red-600",
  deleted: "bg-subtle text-muted",
};

interface Props {
  task: Task;
  index: number;
  data: DayResponse;
  now: number;
  onUpdate: (data: DayResponse) => void;
  // drag to reorder (only while planning)
  draggable: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragEnd: () => void;
}

export function TaskRow({ task, index, data, now, onUpdate, draggable, isDragging, onDragStart, onDragOver, onDragEnd }: Props) {
  const { notify } = useNotifications();
  const { day } = data;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [minutes, setMinutes] = useState(String(task.duration_minutes ?? "")); // "" = no time set
  const [showDetails, setShowDetails] = useState(false);
  const minutesOptional = day.mode !== "timer"; // only timer mode needs minutes

  const isPlanning = day.status === "planning";
  const isActive = day.status === "active";
  const isOpen = task.status === "planned" || task.status === "running";
  const canComplete =
    isActive && !day.paused_at && (day.mode === "timer" ? task.status === "running" : task.status === "planned");

  function startEditing() {
    setTitle(task.title);
    setMinutes(String(task.duration_minutes ?? ""));
    setEditing(true);
  }

  async function completeTask() {
    try {
      const res = await api.post<DayResponse>(`/tasks/${task.id}/complete`);
      onUpdate(res.data);
    } catch (error) {
      notify("danger", "Couldn't complete task", errorMessage(error));
    }
  }

  async function saveEdit() {
    const newMinutes = minutes === "" ? null : Number(minutes);
    const longerTimer = day.mode === "timer" && (newMinutes ?? 0) > (task.duration_minutes ?? 0);
    if (isActive && longerTimer && !task.is_break) {
      if (!window.confirm(`Making the timer longer costs ${formatReward(REWARDS.extendTimer)}. Continue?`)) return;
    }
    try {
      const res = await api.patch<DayResponse>(`/tasks/${task.id}`, { title, duration_minutes: newMinutes });
      onUpdate(res.data);
      setEditing(false);
    } catch (error) {
      notify("danger", "Couldn't save task", errorMessage(error));
    }
  }

  async function deleteTask() {
    // After the day starts, deleting costs XP/coins, unless you have a Delete card
    const deleteCards = data.status.inventory.delete_card ?? 0;
    const useCard = isActive && !task.is_break && deleteCards > 0;

    if (useCard) {
      if (!window.confirm(`Use a Delete card? You have ${deleteCards}. No XP or coins lost.`)) return;
    } else if (isActive && !task.is_break) {
      if (!window.confirm(`Deleting a task after the day starts costs ${formatReward(REWARDS.deleteTask)}. Continue?`)) return;
    }

    try {
      const res = await api.delete<DayResponse>(`/tasks/${task.id}`, { params: { use_card: useCard } });
      onUpdate(res.data);
    } catch (error) {
      notify("danger", "Couldn't delete task", errorMessage(error));
    }
  }

  // Saving details is always free, even after the day starts
  async function saveDetails(details: string) {
    try {
      const res = await api.patch<DayResponse>(`/tasks/${task.id}`, { details });
      onUpdate(res.data);
    } catch (error) {
      notify("danger", "Couldn't save details", errorMessage(error));
    }
  }

  // ----- edit mode -----
  if (editing) {
    return (
      <li onDragOver={onDragOver} className="flex flex-wrap items-center gap-2 rounded-lg border border-accent bg-surface p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-40 flex-1 rounded-md border border-line px-2 py-1 text-sm"
        />
        <input
          type="number"
          min={1}
          max={1440}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder={minutesOptional ? "none" : ""}
          required={!minutesOptional}
          className="w-20 rounded-md border border-line px-2 py-1 text-sm"
        />
        <span className="text-xs text-muted">min</span>
        <button onClick={saveEdit} className="rounded-md bg-accent px-3 py-1 text-sm text-white">
          Save
        </button>
        <button onClick={() => setEditing(false)} className="rounded-md px-3 py-1 text-sm text-muted">
          Cancel
        </button>
      </li>
    );
  }

  // ----- normal view -----
  const showTimer = day.mode === "timer" && task.status === "running";
  const remaining = taskRemainingSeconds(task, day, now);
  const progress = 1 - remaining / ((task.duration_minutes ?? 1) * 60);

  return (
    <li
      draggable={draggable && !showDetails}
      onDragStart={(e) => {
        setDragData(e, { kind: "task", id: task.id });
        onDragStart();
      }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`rounded-lg border bg-surface p-3 transition-opacity ${
        task.status === "running" ? "border-accent shadow-sm" : "border-line"
      } ${task.is_break ? "bg-sky-500/10" : ""} ${draggable && !showDetails ? "cursor-grab active:cursor-grabbing" : ""} ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {draggable && (
          <span aria-hidden title="Drag to reorder" className="select-none text-muted">
            ⋮⋮
          </span>
        )}
        <DetailsArrow open={showDetails} hasDetails={task.details !== ""} onToggle={() => setShowDetails(!showDetails)} />
        <span className="w-4 text-center text-xs text-muted">{index + 1}</span>

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${task.status === "completed" ? "text-muted line-through" : ""}`}>
            {task.title}
            {task.is_break && <span className="ml-2 text-xs font-normal text-sky-600">break</span>}
          </p>
          <p className="text-xs text-muted">
            {task.duration_minutes !== null ? `${task.duration_minutes} min` : "No time set"}
          </p>
        </div>

        {showTimer && <span className="font-mono text-lg text-accent-ink">{formatSeconds(remaining)}</span>}

        <span className={`rounded px-2 py-0.5 text-xs capitalize ${statusStyles[task.status]}`}>{task.status}</span>

        <div className="flex items-center gap-1">
          {canComplete && (
            <button
              onClick={completeTask}
              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
            >
              Done
            </button>
          )}
          {(isPlanning || isActive) && isOpen && (
            <>
              <button onClick={startEditing} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-subtle">
                Edit
              </button>
              <button onClick={deleteTask} className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-500/10">
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {showTimer && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {showDetails && <DetailsBox value={task.details} onSave={saveDetails} />}
    </li>
  );
}
