"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import type { ScheduledTask } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { localDate, prettyDate, prettyTimeRange } from "@/lib/dates";
import { focusLook, useScrollFocus } from "@/lib/scrollFocus";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { PAPER } from "./ScheduledNote";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface Props {
  tasks: ScheduledTask[];
  selected: string; // "YYYY-MM-DD"
  onSelect: (date: string) => void;
  onAdd: (date: string) => void; // the + button: schedule something on the selected date
  onDeleted: (id: number) => void; // the X button deleted a scheduled task
}

// A month calendar for the Scheduler tab (our own code, no calendar library).
// Days with scheduled tasks get a dot in the same color as the task's sticky note.
// Below it: the selected day's tasks. Only that list scrolls (with the same scroll focus effect as the
// notification column), so the month grid always stays in view.
export function ScheduleCalendar({ tasks, selected, onSelect, onAdd, onDeleted }: Props) {
  const { notify } = useNotifications();
  const today = localDate();

  // The month being shown: any date inside it (we only use its year and month)
  const [shownMonth, setShownMonth] = useState(() => new Date(`${selected}T12:00:00`));
  const year = shownMonth.getFullYear();
  const month = shownMonth.getMonth(); // 0 = January

  function changeMonth(by: number) {
    setShownMonth(new Date(year, month + by, 1));
  }

  // Select a day, and flip the calendar to its month if it's in another one
  function selectDate(date: string) {
    onSelect(date);
    setShownMonth(new Date(`${date}T12:00:00`));
  }

  // 6 weeks x 7 days = 42 boxes, starting on the Sunday on/before the 1st.
  // Always 6 rows, so the calendar's height doesn't jump between months.
  const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
  const days = Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - firstWeekday + i));

  // Tasks per date, e.g. { "2026-10-24": [task, task] }, each day's list sorted by time
  const tasksByDate: Record<string, ScheduledTask[]> = {};
  for (const task of tasks) {
    (tasksByDate[task.date] ??= []).push(task);
  }
  for (const list of Object.values(tasksByDate)) {
    list.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  }

  const selectedTasks = tasksByDate[selected] ?? [];
  const listRef = useRef<HTMLUListElement>(null);
  const focusedIndex = useScrollFocus(listRef, `${selected}-${selectedTasks.length}`); // re-check when the day or its tasks change

  // The X on a task: same as deleting its sticky note
  async function deleteTask(task: ScheduledTask) {
    if (!window.confirm(`Delete "${task.title}" from your schedule?`)) return;
    try {
      await api.delete(`/schedule/${task.id}`);
      onDeleted(task.id);
    } catch (error) {
      notify("danger", "Couldn't delete it", errorMessage(error));
    }
  }
  // For an empty day: point to the next thing coming up
  const nextUp = tasks
    .filter((t) => t.date > selected && t.status === "scheduled")
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))[0];

  const monthTitle = shownMonth.toLocaleDateString([], { month: "long", year: "numeric" });
  const selectedTitle = new Date(`${selected}T12:00:00`).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    // When the calendar is pinned beside the notes (@3xl), the card is at most the screen height minus the
    // page header (--calendar-top, set by the Scheduler page), and the day's list below the grid scrolls.
    <section className="flex flex-col rounded-xl border border-line bg-surface py-4 @3xl:max-h-[calc(100vh-var(--calendar-top,6rem)-1.5rem)]">
      {/* ----- month header ----- */}
      <div className="flex items-center justify-between px-4">
        <button onClick={() => changeMonth(-1)} aria-label="Previous month" className="rounded-md p-1 text-muted hover:bg-subtle hover:text-ink">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium">{monthTitle}</p>
        <button onClick={() => changeMonth(1)} aria-label="Next month" className="rounded-md p-1 text-muted hover:bg-subtle hover:text-ink">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ----- the grid of days ----- */}
      <div className="mt-3 grid grid-cols-7 gap-y-1 px-3 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pb-1 text-[11px] text-muted">
            {day}
          </span>
        ))}

        {days.map((day) => {
          const key = localDate(day);
          const inMonth = day.getMonth() === month;
          const isSelected = key === selected;
          const isToday = key === today;
          const dayTasks = tasksByDate[key] ?? [];

          return (
            <button
              key={key}
              onClick={() => selectDate(key)} // a grey day from the next/previous month flips to that month
              aria-label={`${prettyDate(key)}${dayTasks.length ? `, ${dayTasks.length} scheduled` : ""}`}
              aria-pressed={isSelected}
              className={`relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-md text-sm transition ${
                isSelected
                  ? "bg-accent font-medium text-white"
                  : isToday
                    ? "bg-accent-soft font-medium text-accent-ink"
                    : inMonth
                      ? "text-ink hover:bg-subtle"
                      : "text-muted/50 hover:bg-subtle"
              }`}
            >
              {day.getDate()}
              {/* up to 3 dots: one per task, in its sticky-note color */}
              {dayTasks.length > 0 && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <span
                      key={task.id}
                      className="h-1 w-1 rounded-full"
                      style={{ background: isSelected ? "white" : PAPER[task.id % PAPER.length].header }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ----- the selected day ----- */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 border-t border-line px-4 pt-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-medium">{selectedTitle}</p>
          {selected >= today && (
            <button
              onClick={() => onAdd(selected)}
              title="Schedule something on this day"
              className="rounded-md p-1 text-muted hover:bg-subtle hover:text-ink"
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">Schedule something on this day</span>
            </button>
          )}
        </div>

        {selectedTasks.length === 0 ? (
          <p className="px-1 text-xs text-muted">
            Nothing scheduled.
            {nextUp && (
              <>
                {" "}
                Next up:{" "}
                <button onClick={() => selectDate(nextUp.date)} className="text-accent-ink underline-offset-2 hover:underline">
                  {nextUp.title} ({prettyDate(nextUp.date)})
                </button>
              </>
            )}
          </p>
        ) : (
          // relative: positions are measured from here (scroll focus). max-h-72 when stacked under the notes;
          // when pinned, the card's own max height decides and this list takes the space that's left.
          <ul ref={listRef} className="relative -mr-2 flex max-h-72 min-h-0 flex-col gap-2 overflow-y-auto pr-2 [scrollbar-gutter:stable] @3xl:max-h-none">
            {selectedTasks.map((task, index) => (
              <motion.li
                key={task.id}
                data-focus-index={index} // the list uses this to find which task is in focus
                animate={focusLook(index, focusedIndex)}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className="group relative shrink-0 rounded-md bg-subtle p-2 pr-8 pl-6 text-sm"
              >
                {/* the colored bar on the left, matching the sticky note */}
                <span
                  className="absolute inset-y-2 left-2 w-1 rounded-full"
                  style={{ background: PAPER[task.id % PAPER.length].header }}
                />
                <p className={`font-medium ${task.status === "dismissed" ? "text-muted line-through" : ""}`}>{task.title}</p>
                <p className="text-xs text-muted">
                  {task.time ? prettyTimeRange(task.time, task.duration_minutes) : "Any time"}
                  {!task.time && task.duration_minutes && ` · ${task.duration_minutes} min`}
                  {task.status === "added" && " · added to plan"}
                  {task.status === "dismissed" && " · ignored"}
                </p>
                <button
                  type="button"
                  onClick={() => deleteTask(task)}
                  aria-label={`Delete ${task.title}`}
                  title="Delete"
                  className="absolute top-2 right-1.5 flex h-6 w-6 items-center justify-center rounded-full text-muted/60 transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
