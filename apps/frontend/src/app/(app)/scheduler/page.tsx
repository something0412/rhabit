"use client";

import { useEffect, useRef, useState } from "react";
import type { ScheduledTask } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { localDate, prettyDate } from "@/lib/dates";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { ScheduledNote } from "@/components/schedule/ScheduledNote";
import { ScheduleCalendar } from "@/components/schedule/ScheduleCalendar";
import { SearchBar } from "@/components/common/SearchBar";
import { HoloButton } from "@/components/common/HoloButton";
import { TimePicker } from "@/components/common/TimePicker";

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDate(d);
}

// Soonest first; on the same day, "any time" first, then by time
function byDateAndTime(a: ScheduledTask, b: ScheduledTask): number {
  return a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "");
}

export default function SchedulerPage() {
  const { notify } = useNotifications();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);

  // form fields
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(tomorrow);
  const [hasTime, setHasTime] = useState(false);
  const [time, setTime] = useState("09:00");
  const [minutes, setMinutes] = useState("");
  const [details, setDetails] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);

  // the day picked on the calendar (starts on today)
  const [calendarDate, setCalendarDate] = useState(() => localDate());
  const [search, setSearch] = useState("");

  // The header (title + search) stays pinned at the top while the page scrolls, and the calendar is
  // pinned just below it. The header's height changes when its text wraps, so measure it.
  // (ResizeObserver = "tell me when this element changes size")
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(88);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const watcher = new ResizeObserver(() => setHeaderHeight(header.offsetHeight));
    watcher.observe(header);
    return () => watcher.disconnect();
  }, []);
  const calendarTop = headerHeight + 12; // a little space under the header

  useEffect(() => {
    async function loadSchedule() {
      try {
        const res = await api.get<ScheduledTask[]>("/schedule");
        setTasks(res.data);
      } catch (error) {
        notify("danger", "Couldn't load your schedule", errorMessage(error));
      } finally {
        setLoading(false);
      }
    }
    loadSchedule();
  }, []);

  async function addScheduledTask(event: React.FormEvent) {
    event.preventDefault();
    try {
      const res = await api.post<ScheduledTask>("/schedule", {
        title,
        date,
        time: hasTime ? time : null,
        duration_minutes: minutes ? Number(minutes) : null,
        details,
      });
      setTasks([...tasks, res.data]);
      setTitle("");
      setMinutes("");
      setDetails("");
      notify("success", `Scheduled "${res.data.title}"`, `It will show up in your bucket on ${prettyDate(res.data.date)}.`);
    } catch (error) {
      notify("danger", "Couldn't schedule it", errorMessage(error));
    }
  }

  // The calendar's + button: fill in that date and jump to the Task box
  function scheduleOn(day: string) {
    setDate(day);
    titleInput.current?.focus();
  }

  function taskChanged(changed: ScheduledTask) {
    setTasks(tasks.map((t) => (t.id === changed.id ? changed : t)));
  }

  function taskDeleted(id: number) {
    setTasks(tasks.filter((t) => t.id !== id));
  }

  const today = localDate();
  // Search: only the sticky notes are filtered (the calendar always shows everything)
  const query = search.trim().toLowerCase();
  const matching = tasks.filter(
    (t) => t.title.toLowerCase().includes(query) || t.details.toLowerCase().includes(query)
  );
  const upcoming = matching.filter((t) => t.date >= today);
  const past = matching.filter((t) => t.date < today);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      {/* sticky top-0: pinned at the top. -mx-6 -mt-6 + padding + bg-page: covers the full width, so the
          sticky notes scroll underneath it instead of showing through. z-20: above the tilted notes. */}
      <header
        ref={headerRef}
        className="sticky top-0 z-20 -mx-6 -mt-6 flex flex-wrap items-end justify-between gap-3 bg-page px-6 pt-6 pb-3"
      >
        <div>
          <h1 className="text-2xl font-semibold">Scheduler</h1>
          <p className="text-sm text-muted">
            Plan tasks for a future day. On that day they appear in your to-do bucket, and you choose whether to add them.
          </p>
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search scheduled tasks..." />
      </header>

      {/* Left: the form and the sticky notes. Right: the calendar (it moves below on narrow screens).
          The left column is its own @container, so the notes grid fits the space next to the calendar. */}
      <div className="grid grid-cols-1 items-start gap-6 @3xl:grid-cols-[1fr_18rem]">
        <div className="@container flex min-w-0 flex-col gap-4">
          <form onSubmit={addScheduledTask} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted">
                Task
                <input
                  ref={titleInput}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Dentist appointment"
                  required
                  className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Date
                <input
                  type="date"
                  value={date}
                  min={today}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <label className="flex items-center gap-2 pb-2 text-sm text-muted">
                <input type="checkbox" checked={hasTime} onChange={(e) => setHasTime(e.target.checked)} />
                At a specific time
              </label>
              {hasTime && (
                <TimePicker value={time} onChange={setTime} minuteStep={5} ariaLabel="Time" />
              )}
              <label className="flex w-36 flex-col gap-1 text-xs text-muted">
                Minutes (optional)
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="e.g. 60"
                  className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
                />
              </label>
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Details (optional), e.g. bring insurance card"
              rows={1}
              className="resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />

            <HoloButton type="submit" className="self-start">
              Schedule it
            </HoloButton>
          </form>

          {loading && <p className="text-sm text-muted">Loading...</p>}
          {!loading && upcoming.length === 0 && (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
              {query ? `No upcoming tasks match "${search.trim()}".` : "Nothing scheduled yet."}
            </p>
          )}

          {/* The board of sticky notes, soonest first */}
          {upcoming.length > 0 && (
            <ul className="grid grid-cols-2 gap-x-5 gap-y-7 pt-3 @xl:grid-cols-3 @3xl:grid-cols-4">
              {[...upcoming].sort(byDateAndTime).map((task) => (
                <ScheduledNote key={task.id} task={task} today={today} onChanged={taskChanged} onDeleted={taskDeleted} />
              ))}
            </ul>
          )}

          {past.length > 0 && (
            <details className="rounded-xl border border-line bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-muted">Past ({past.length})</summary>
              <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-7 @xl:grid-cols-3 @3xl:grid-cols-4">
                {[...past]
                  .sort(byDateAndTime)
                  .reverse()
                  .map((task) => (
                    <ScheduledNote key={task.id} task={task} today={today} onChanged={taskChanged} onDeleted={taskDeleted} />
                  ))}
              </ul>
            </details>
          )}
        </div>

        {/* pinned under the header when the calendar sits beside the notes (@3xl).
            --calendar-top tells the calendar how much screen is left for it. */}
        <aside
          className="w-full max-w-sm @3xl:sticky @3xl:max-w-none"
          style={{ top: calendarTop, "--calendar-top": `${calendarTop}px` } as React.CSSProperties}
        >
          <ScheduleCalendar
            tasks={tasks}
            selected={calendarDate}
            onSelect={setCalendarDate}
            onAdd={scheduleOn}
            onDeleted={taskDeleted}
          />
        </aside>
      </div>
    </div>
  );
}
