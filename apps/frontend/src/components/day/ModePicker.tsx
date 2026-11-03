"use client";

import type { DayMode, DayResponse } from "@productivity/shared";
import { AlarmClock, Lock, Timer, Waves, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { TimePicker } from "@/components/common/TimePicker";

const modes: { mode: DayMode; title: string; description: string; Icon: LucideIcon }[] = [
  { mode: "timer", title: "Timer", description: "Every task gets its own countdown, one after another.", Icon: Timer },
  { mode: "deadline", title: "Deadline", description: "Finish all tasks before a set time.", Icon: AlarmClock },
  { mode: "flexible", title: "Flexible", description: "No timers, no deadline. You've earned it.", Icon: Waves },
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

      <div role="radiogroup" aria-label="Mode" className="mt-3 grid grid-cols-1 gap-3 @xl:grid-cols-3">
        {modes.map((m) => {
          const isFlexible = m.mode === "flexible";
          const locked = isFlexible && !flexible.unlocked && flexibleCards === 0;
          const selected = day.mode === m.mode;
          const note = isFlexible ? flexibleNote() : null;

          // A "radio card" (style based on Lightswind's Smart Radio Group):
          // icon square top-left, radio dot top-right, title + description below.
          // When picked, a shaded fill sweeps across the card from the left.
          return (
            <button
              key={m.mode}
              role="radio"
              aria-checked={selected}
              onClick={() => chooseMode(m.mode)}
              disabled={locked}
              className={`relative overflow-hidden rounded-xl border p-3 text-left transition-colors ${
                selected ? "border-accent" : "border-line hover:bg-subtle"
              } ${locked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {/* The shaded fill. initial={false}: no sweep on page load, only when you pick a mode. */}
              <AnimatePresence initial={false}>
                {selected && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 origin-left bg-accent-soft"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>

              {/* relative: keeps the content above the fill */}
              <div className="relative">
                <div className="flex items-start justify-between">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-300 ${
                      selected ? "bg-accent text-white" : "bg-subtle text-muted"
                    }`}
                  >
                    <m.Icon className="h-4 w-4" aria-hidden />
                  </span>
                  {/* the radio dot */}
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
                      selected ? "border-accent" : "border-line"
                    }`}
                  >
                    <AnimatePresence initial={false}>
                      {selected && (
                        <motion.span
                          className="h-2 w-2 rounded-full bg-accent"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        />
                      )}
                    </AnimatePresence>
                  </span>
                </div>

                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold">
                  {m.title}
                  {/* locked: a wave = you have a Flexible Day card to use, a lock = you don't */}
                  {isFlexible && !flexible.unlocked &&
                    (flexibleCards > 0 ? <Waves className="h-3.5 w-3.5" aria-hidden /> : <Lock className="h-3.5 w-3.5" aria-hidden />)}
                </p>
                <p className="mt-1 text-xs text-muted">{note ?? m.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {day.mode === "deadline" && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <span className="text-muted">Finish everything by</span>
          <TimePicker value={toTimeInput(day.deadline_at)} onChange={setDeadline} ariaLabel="Deadline" />
        </div>
      )}
    </section>
  );
}
