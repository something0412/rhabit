"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, Coffee, GripVertical, Pencil, Timer, X } from "lucide-react";
import type { DayResponse, Task, TaskStatus } from "@productivity/shared";
import { REWARDS, formatSeconds, taskRemainingSeconds } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { formatReward } from "@/lib/rewards";
import { setDragData } from "@/lib/dragData";
import { focusLook } from "@/lib/scrollFocus";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { DetailsArrow, DetailsBox } from "@/components/common/Details";
import { HoloButton } from "@/components/common/HoloButton";

// Colors of the icon box on the left of each task
const badgeStyles: Record<TaskStatus, string> = {
  planned: "bg-subtle text-muted",
  running: "bg-accent-soft text-accent-ink",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  missed: "bg-red-500/15 text-red-600 dark:text-red-400",
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
  focusedIndex: number | null; // which task the scroll focus is on (null = the list doesn't scroll)
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragEnd: () => void;
  onDeleted: () => void; // a task was deleted (the Main page reloads the bucket: the task may go back there)
}

export function TaskRow({ task, index, data, now, onUpdate, draggable, isDragging, focusedIndex, onDragStart, onDragOver, onDragEnd, onDeleted }: Props) {
  const { notify } = useNotifications();
  const { day } = data;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [minutes, setMinutes] = useState(String(task.duration_minutes ?? "")); // "" = no time set
  const [showDetails, setShowDetails] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null); // the whole card (used as the picture while dragging)
  // A task that just started (timer mode) scrolls into view, so it's never faded at the edge
  useEffect(() => {
    if (task.status === "running") rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [task.status]);

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
      onDeleted();
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
      <li onDragOver={onDragOver} className="flex flex-wrap items-center gap-2 rounded-xl border border-accent bg-surface px-4 py-3 shadow-sm">
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
        <HoloButton onClick={saveEdit} size="sm">
          Save
        </HoloButton>
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

  // The small box on the left: the task's number while it waits, otherwise an icon for its status
  const badge = task.is_break ? (
    <Coffee className="h-4 w-4" />
  ) : task.status === "completed" ? (
    <Check className="h-4 w-4" />
  ) : task.status === "missed" ? (
    <X className="h-4 w-4" />
  ) : task.status === "running" ? (
    <Timer className="h-4 w-4" />
  ) : (
    <span className="text-xs font-medium">{index + 1}</span>
  );

  // Scroll focus effect: the focused task is full size, neighbors almost, the rest a bit smaller and faded
  const look = focusLook(index, focusedIndex);

  return (
    // motion.li = a normal <li> that can animate:
    //  - initial/animate: a new task fades and slides in
    //  - layout: after reordering, tasks glide to their new spot instead of jumping
    <motion.li
      ref={rowRef}
      layout="position"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: isDragging ? 0.4 : look.opacity, y: 0, scale: look.scale }}
      data-focus-index={index} // the list uses this to find which task is in focus
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      onDragOver={onDragOver}
      className={`rounded-xl border px-4 py-3 shadow-sm transition-shadow hover:shadow-md ${
        task.status === "running" ? "border-accent" : "border-line"
      } ${task.is_break ? "bg-sky-500/10" : "bg-surface"}`}
    >
      <div className="flex items-center gap-3">
        {/* Drag handle: only this part starts a drag, so clicking buttons never drags by accident */}
        {draggable && (
          <span
            draggable
            onDragStart={(e) => {
              setDragData(e, { kind: "task", id: task.id });
              // Show the whole card under the mouse while dragging, not just the little handle
              if (rowRef.current) {
                const box = rowRef.current.getBoundingClientRect();
                e.dataTransfer.setDragImage(rowRef.current, e.clientX - box.left, e.clientY - box.top);
              }
              onDragStart();
            }}
            onDragEnd={onDragEnd}
            title="Drag to reorder"
            className="shrink-0 cursor-grab text-muted/40 transition-colors hover:text-muted active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </span>
        )}

        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            task.is_break ? "bg-sky-500/15 text-sky-600 dark:text-sky-400" : badgeStyles[task.status]
          }`}
        >
          {badge}
        </span>

        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${task.status === "completed" ? "text-muted line-through" : ""}`}>
            {task.title}
            {task.is_break && <span className="ml-2 text-xs font-normal text-sky-600 dark:text-sky-400">break</span>}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {task.duration_minutes !== null ? `${task.duration_minutes} min` : "No time set"}
            {task.status !== "planned" && <span className="capitalize"> · {task.status}</span>}
          </p>

          {/* A preview of the details, then "..." if there's more:
              1 line on a landscape screen (desktop), 2 lines on a portrait screen (phone held upright).
              Clicking it opens the full details below, same as the arrow. */}
          {task.details !== "" && !showDetails && (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              title="Show all details"
              className="mt-1 block w-full text-left"
            >
              <p className="line-clamp-1 text-xs portrait:line-clamp-2 whitespace-pre-line text-muted/80 hover:text-muted">{task.details}</p>
            </button>
          )}
        </div>

        {showTimer && <span className="font-mono text-lg text-accent-ink">{formatSeconds(remaining)}</span>}

        <DetailsArrow open={showDetails} onToggle={() => setShowDetails(!showDetails)} />

        <div className="flex items-center gap-1">
          {canComplete && (
            <HoloButton onClick={completeTask} size="sm" tone="success">
              Done
            </HoloButton>
          )}
          {(isPlanning || isActive) && isOpen && (
            <>
              <button
                onClick={startEditing}
                aria-label={`Edit ${task.title}`}
                title="Edit"
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted/60 transition-colors hover:bg-subtle hover:text-ink"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={deleteTask}
                aria-label={`Delete ${task.title}`}
                title="Delete"
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted/60 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
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
    </motion.li>
  );
}
