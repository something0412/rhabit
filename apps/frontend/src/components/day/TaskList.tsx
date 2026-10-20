"use client";

import { Fragment, useState } from "react";
import type { BucketSource, DayResponse } from "@productivity/shared";
import { RULES } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { clearDragData, getCurrentDrag, readDragData } from "@/lib/dragData";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { TaskRow } from "./TaskRow";
import { BreakSuggestion } from "./BreakSuggestion";

interface Props {
  data: DayResponse;
  now: number;
  onUpdate: (data: DayResponse) => void;
  // A bucket item was dropped at this spot in the list (0 = first)
  onBucketDrop: (item: { source: BucketSource; id: number }, insertAt: number) => void;
}

export function TaskList({ data, now, onUpdate, onBucketDrop }: Props) {
  const { notify } = useNotifications();
  const { day, tasks } = data;
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [dropIndex, setDropIndex] = useState<number | null>(null); // where the drop line is shown
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);

  const canReorder = day.status === "planning";
  const canAddFromBucket = day.status === "planning" || day.status === "active";

  // Is the thing being dragged allowed to land in this list?
  function acceptsCurrentDrag(): boolean {
    const drag = getCurrentDrag();
    return (drag?.kind === "task" && canReorder) || (drag?.kind === "bucket" && canAddFromBucket);
  }

  // Hovering over a row: top half = drop BEFORE it, bottom half = drop AFTER it
  function dragOverRow(event: React.DragEvent, index: number) {
    if (!acceptsCurrentDrag()) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setDropIndex(event.clientY < rect.top + rect.height / 2 ? index : index + 1);
  }

  async function drop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation(); // the Main page's own drop zone shouldn't handle it too
    const index = dropIndex;
    setDropIndex(null);
    const dragged = readDragData(event);
    if (!dragged || index === null) return;

    if (dragged.kind === "bucket") {
      onBucketDrop(dragged, index);
      return;
    }

    if (dragged.kind === "task") {
      // Build the new order: take the task out, put it back at the drop spot
      const ids = tasks.map((t) => t.id);
      const from = ids.indexOf(dragged.id);
      if (from === -1) return;
      ids.splice(from, 1);
      const to = from < index ? index - 1 : index; // removing it shifted later spots up by one
      if (to === from) return; // dropped where it already was
      ids.splice(to, 0, dragged.id);

      try {
        const res = await api.put<DayResponse>(`/days/${day.id}/order`, { task_ids: ids });
        onUpdate(res.data);
      } catch (error) {
        notify("danger", "Couldn't reorder", errorMessage(error));
      }
    }
  }

  // Break suggestions (only while planning): after 3h+ of tasks in a row with no break,
  // suggest one after that task. Then start counting again.
  const suggestions = new Map<number, number>(); // taskId -> minutes in a row
  if (day.status === "planning") {
    let minutesInARow = 0;
    tasks.forEach((task, i) => {
      if (task.is_break) {
        minutesInARow = 0;
        return;
      }
      minutesInARow += task.duration_minutes ?? 0;
      const nextIsBreak = tasks[i + 1]?.is_break ?? false;
      if (minutesInARow >= RULES.breakSuggestAfterMinutes && !nextIsBreak) {
        suggestions.set(task.id, minutesInARow);
        minutesInARow = 0;
      }
    });
  }

  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
        No tasks yet. Add one below{canAddFromBucket ? ", or drag one in from the bucket" : ""}.
      </p>
    );
  }

  const dropLine = <li aria-hidden className="h-1 rounded-full bg-accent" />;

  return (
    <ul
      onDragOver={(e) => {
        if (!acceptsCurrentDrag()) return;
        e.preventDefault(); // allows dropping here
        e.stopPropagation();
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropIndex(null);
      }}
      onDrop={drop}
      className="flex flex-col gap-2"
    >
      {tasks.map((task, index) => (
        <Fragment key={task.id}>
          {dropIndex === index && dropLine}

          <TaskRow
            task={task}
            index={index}
            data={data}
            now={now}
            onUpdate={onUpdate}
            draggable={canReorder}
            isDragging={draggingTaskId === task.id}
            onDragStart={() => setDraggingTaskId(task.id)}
            onDragOver={(e) => dragOverRow(e, index)}
            onDragEnd={() => {
              clearDragData();
              setDraggingTaskId(null);
              setDropIndex(null);
            }}
          />

          {suggestions.has(task.id) && !dismissed.includes(task.id) && (
            <BreakSuggestion
              dayId={day.id}
              afterTaskId={task.id}
              minutesInARow={suggestions.get(task.id)!}
              onDismiss={() => setDismissed([...dismissed, task.id])}
              onUpdate={onUpdate}
            />
          )}
        </Fragment>
      ))}

      {dropIndex === tasks.length && dropLine}
    </ul>
  );
}
