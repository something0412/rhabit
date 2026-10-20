"use client";

import type { DayMode, DayResponse } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { useNotifications } from "@/components/notifications/NotificationProvider";

const modes: { mode: DayMode; title: string; description: string }[] = [
  { mode: "timer", title: "Timer", description: "Every task gets its own countdown, one after another." },
  { mode: "deadline", title: "Deadline", description: "Finish all tasks before a set time." },
  { mode: "flexible", title: "Flexible", description: "No timers, no deadline. You've earned it." },
];

// "2026-10-20T22:00:00Z" -> "17:00" (in the browser's local time)
function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ModePicker({ data, onUpdate }: { data: DayResponse; onUpdate: (data: DayResponse) => void }) {
  const { notify } = useNotifications();
  const { day, status } = data;
  const { flexible, level } = status;
  const flexibleCards = status.inventory.flexible_card ?? 0;

  // Why is flexible mode locked (or how can you use it anyway)?
  function flexibleNote(): string | null {
    if (flexible.unlocked) return null;
    const reason = flexible.bad_week
      ? `Locked: ${flexible.missed_this_week} missed tasks this week.`
      : `Unlocks at Level ${flexible.level_needed} (you're Level ${level.level}).`;
    return flexibleCards > 0 ? `${reason} Uses 1 Flexible Day card (you have ${flexibleCards}).` : reason;
  }

  async function chooseMode(mode: DayMode) {
    try {
      const res = await api.patch<DayResponse>(`/days/${day.id}`, { mode });
      onUpdate(res.data);
    } catch (error) {
      notify("danger", "Couldn't change mode", errorMessage(error));
    }
  }

  async function setDeadline(time: string) {
    if (!time) return;
    // The deadline is that time on this plan's date, in local time
    const deadlineAt = new Date(`${day.date}T${time}`).toISOString();
    try {
      const res = await api.patch<DayResponse>(`/days/${day.id}`, { deadline_at: deadlineAt });
      onUpdate(res.data);
    } catch (error) {
      notify("danger", "Couldn't set deadline", errorMessage(error));
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">Mode</h2>

      <div className="mt-3 grid grid-cols-1 gap-3 @xl:grid-cols-3">
        {modes.map((m) => {
          const isFlexible = m.mode === "flexible";
          const locked = isFlexible && !flexible.unlocked && flexibleCards === 0;
          const selected = day.mode === m.mode;
          const note = isFlexible ? flexibleNote() : null;

          return (
            <button
              key={m.mode}
              onClick={() => chooseMode(m.mode)}
              disabled={locked}
              className={`rounded-lg border p-3 text-left transition ${
                selected ? "border-accent bg-accent-soft" : "border-line hover:bg-subtle"
              } ${locked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <p className="text-sm font-medium">
                {m.title} {isFlexible && !flexible.unlocked && (flexibleCards > 0 ? "🌀" : "🔒")}
              </p>
              <p className="mt-1 text-xs text-muted">{note ?? m.description}</p>
            </button>
          );
        })}
      </div>

      {day.mode === "deadline" && (
        <label className="mt-4 flex items-center gap-3 text-sm">
          <span className="text-muted">Finish everything by</span>
          <input
            type="time"
            defaultValue={toTimeInput(day.deadline_at)}
            onChange={(e) => setDeadline(e.target.value)}
            className="rounded-md border border-line bg-surface px-2 py-1"
          />
        </label>
      )}
    </section>
  );
}
