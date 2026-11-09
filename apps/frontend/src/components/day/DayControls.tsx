"use client";

import { useState } from "react";
import { RotateCcw, TreePalm } from "lucide-react";
import type { DayResponse } from "@productivity/shared";
import { REWARDS, currentDeadline, deadlineRemainingSeconds, flexibleWorkSeconds, formatDuration, formatSeconds } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { formatReward } from "@/lib/rewards";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { EmergencyStopDialog } from "./EmergencyStopDialog";
import { HoloButton } from "@/components/common/HoloButton";

interface Props {
  data: DayResponse;
  now: number;
  isToday: boolean;
  onUpdate: (data: DayResponse) => void;
}

// The bar at the top: Start / Day off / Pause / Resume / Emergency stop / End day
export function DayControls({ data, now, isToday, onUpdate }: Props) {
  const { notify } = useNotifications();
  const [askEmergency, setAskEmergency] = useState(false); // the "are you sure?" box is open
  const { day, status, profile } = data;
  const dayOffCards = status.inventory.day_off_card ?? 0;

  // No free emergency stops left: show what the next one costs (coins if you have any, otherwise XP).
  // The server never takes more than you have (floor at 0).
  const freeStopsLeft = status.emergency_stops_left;
  const emergencyCost =
    profile.coins > 0 ? `${-REWARDS.paidEmergencyStop.coins} coins` : `${-REWARDS.paidEmergencyStopNoCoins.xp} XP`;

  async function startDay() {
    try {
      const res = await api.post<DayResponse>(`/days/${day.id}/start`);
      onUpdate(res.data);
    } catch (error) {
      notify("danger", "Couldn't start the day", errorMessage(error));
    }
  }

  async function takeDayOff() {
    if (!window.confirm(`Use a Day Off card for this day? You have ${dayOffCards}.`)) return;
    try {
      const res = await api.post<DayResponse>(`/days/${day.id}/day-off`);
      onUpdate(res.data);
    } catch (error) {
      notify("danger", "Couldn't take a day off", errorMessage(error));
    }
  }

  async function pauseDay(type: "pause" | "emergency") {
    setAskEmergency(false);
    try {
      const res = await api.post<DayResponse>(`/days/${day.id}/pause`, { type });
      onUpdate(res.data);
      if (type === "emergency") notify("info", "Emergency stop", "Everything is frozen until you press Continue.");
    } catch (error) {
      notify("danger", "Couldn't pause", errorMessage(error));
    }
  }

  async function resumeDay() {
    try {
      const res = await api.post<DayResponse>(`/days/${day.id}/resume`);
      onUpdate(res.data);
    } catch (error) {
      notify("danger", "Couldn't resume", errorMessage(error));
    }
  }

  async function finishDay() {
    const warning =
      day.mode === "flexible"
        ? "End the day now?"
        : `Unfinished tasks will count as missed (${formatReward(REWARDS.missTask)} each). End the day now?`;
    if (!window.confirm(warning)) return;

    try {
      const res = await api.post<DayResponse>(`/days/${day.id}/finish`);
      onUpdate(res.data);
    } catch (error) {
      notify("danger", "Couldn't finish the day", errorMessage(error));
    }
  }

  async function restartDay() {
    const message =
      "Restart today from the beginning?\n\n" +
      "• Every task goes back to planned and timers reset\n" +
      "• No penalties, but any XP and coins from today are undone too";
    if (!window.confirm(message)) return;

    try {
      const res = await api.post<DayResponse>(`/days/${day.id}/restart`);
      onUpdate(res.data);
      notify("info", "Day restarted", "Pick a mode and press Start when you're ready.");
    } catch (error) {
      notify("danger", "Couldn't restart the day", errorMessage(error));
    }
  }

  const restartButton = isToday && (
    <button onClick={restartDay} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-subtle">
      <RotateCcw className="h-4 w-4" aria-hidden /> Restart day
    </button>
  );

  // ----- before the day starts -----
  if (day.status === "planning") {
    return (
      <section className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4">
        <div>
          <p className="text-sm font-medium">{isToday ? "Ready when you are" : "Planning ahead"}</p>
          <p className="text-xs text-muted">
            {isToday ? "Add your tasks, pick a mode, then press Start." : "You can start this plan tomorrow."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={takeDayOff}
            disabled={dayOffCards === 0}
            title={dayOffCards === 0 ? "No Day Off cards. Buy one in the Store." : undefined}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-subtle disabled:opacity-40"
          >
            <TreePalm className="h-4 w-4" aria-hidden /> Day off ({dayOffCards})
          </button>
          {isToday && (
            <HoloButton onClick={startDay}>
              Start day
            </HoloButton>
          )}
        </div>
      </section>
    );
  }

  // ----- the day is over (or a day off) -----
  if (day.status !== "active") {
    const summary = {
      done: { text: "Day complete! Every task finished.", style: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
      failed: { text: "Day ended with missed tasks.", style: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400" },
      excused: { text: "Day excused (emergency). No penalty.", style: "border-line bg-subtle text-muted" },
      day_off: { text: "Day off. Enjoy your rest. No tasks, no penalties.", style: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400" },
    }[day.status];
    return (
      <section className={`flex items-center justify-between gap-4 rounded-xl border p-4 text-sm font-medium ${summary.style}`}>
        <span className="flex items-center gap-2">
          {day.status === "day_off" && <TreePalm className="h-4 w-4" aria-hidden />}
          {summary.text}
        </span>
        {day.status !== "day_off" && restartButton}
      </section>
    );
  }

  // ----- the day is running -----
  const deadlineLeft = deadlineRemainingSeconds(day, now);
  const deadlineAt = currentDeadline(day); // includes any time added by emergency stops
  const isEmergency = day.pause_type === "emergency";
  const isFlexible = day.mode === "flexible"; // no pause, no emergency stop, no End day: it ends at midnight

  return (
    <section
      className={`flex items-center justify-between rounded-xl border p-4 ${
        isEmergency ? "border-red-500/40 bg-red-500/10" : day.paused_at ? "border-amber-500/40 bg-amber-500/10" : "border-line bg-surface"
      }`}
    >
      <div>
        <p className="text-sm font-medium">
          {isEmergency ? (day.emergency_paid ? "Emergency stop (paid)" : "Emergency stop") : day.paused_at ? "Paused" : "Day in progress"}
          <span className="ml-2 rounded bg-subtle px-1.5 py-0.5 text-xs capitalize text-muted">{day.mode} mode</span>
        </p>
        {deadlineLeft !== null && (
          <p className="mt-1 font-mono text-2xl">
            {formatSeconds(deadlineLeft)}{" "}
            <span className="font-sans text-xs text-muted">
              until deadline
              {deadlineAt && ` (${new Date(deadlineAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})`}
              {day.deadline_extra_seconds > 0 && `, moved +${formatDuration(day.deadline_extra_seconds)}`}
            </span>
          </p>
        )}
        {/* Flexible: a count-up timer. It runs while tasks are left and stops when everything is done. */}
        {isFlexible && (
          <p className="mt-1 font-mono text-2xl">
            {formatSeconds(flexibleWorkSeconds(day, now))}{" "}
            <span className="font-sans text-xs text-muted">
              {day.work_running_since ? "working time" : "all done in this time. Add a task to keep going"} · day
              ends at midnight
            </span>
          </p>
        )}
      </div>

      <div className="flex gap-2">
        {isFlexible ? null : day.paused_at ? (
          <HoloButton onClick={resumeDay}>
            Continue
          </HoloButton>
        ) : (
          <>
            {/* No Pause in deadline mode: there are no per-task timers to protect */}
            {day.mode !== "deadline" && (
              <button onClick={() => pauseDay("pause")} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-subtle">
                Pause
              </button>
            )}
            <button
              onClick={() => setAskEmergency(true)}
              title={freeStopsLeft > 0 ? `${freeStopsLeft} free left this week` : `No free stops left this week: costs ${emergencyCost}`}
              className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10"
            >
              Emergency stop{" "}
              <span className="text-xs opacity-80">({freeStopsLeft > 0 ? `${freeStopsLeft} free` : `costs ${emergencyCost}`})</span>
            </button>
          </>
        )}
        {!isFlexible && (
          <button onClick={finishDay} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-subtle">
            End day
          </button>
        )}
        {isToday && (
          <button onClick={restartDay} title="Restart day" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-subtle">
            <RotateCcw className="h-4 w-4" aria-hidden /> Restart
          </button>
        )}
      </div>

      {askEmergency && (
        <EmergencyStopDialog
          freeStopsLeft={freeStopsLeft}
          cost={emergencyCost}
          deadlineMode={day.mode === "deadline"}
          onConfirm={() => pauseDay("emergency")}
          onCancel={() => setAskEmergency(false)}
        />
      )}
    </section>
  );
}
