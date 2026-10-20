"use client";

import { useEffect, useState } from "react";
import type { ScheduledTask } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { localDate, prettyDate } from "@/lib/dates";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { ScheduledNote } from "@/components/schedule/ScheduledNote";

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

  function taskChanged(changed: ScheduledTask) {
    setTasks(tasks.map((t) => (t.id === changed.id ? changed : t)));
  }

  function taskDeleted(id: number) {
    setTasks(tasks.filter((t) => t.id !== id));
  }

  const today = localDate();
  const upcoming = tasks.filter((t) => t.date >= today);
  const past = tasks.filter((t) => t.date < today);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Scheduler</h1>
        <p className="text-sm text-muted">
          Plan tasks for a future day. On that day they appear in your to-do bucket, and you choose whether to add them.
        </p>
      </header>

      <form onSubmit={addScheduledTask} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted">
            Task
            <input
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
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
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

        <button type="submit" className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Schedule it
        </button>
      </form>

      {loading && <p className="text-sm text-muted">Loading...</p>}
      {!loading && upcoming.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Nothing scheduled yet.</p>
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
  );
}
