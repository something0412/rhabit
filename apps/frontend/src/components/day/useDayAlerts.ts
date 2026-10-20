"use client";

import { useEffect, useRef } from "react";
import type { DayResponse, Task } from "@productivity/shared";
import { RULES, deadlineRemainingSeconds, taskRemainingSeconds } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { useNotifications } from "@/components/notifications/NotificationProvider";

// Watches the day every second and sends notifications:
//  - "5 min left" on the running task (timer mode)
//  - 30 min / 5 min before the deadline (deadline mode)
//  - asks the server to check when a countdown hits 0
//  - task started / time's up / day finished / flexible mode unlocked
export function useDayAlerts(data: DayResponse | null, now: number, onUpdate: (data: DayResponse) => void) {
  const { notify } = useNotifications();
  const alreadyWarned = useRef(new Set<string>());
  const lastCheckAt = useRef(0);
  const previous = useRef<DayResponse | null>(null);

  // 1) Countdown warnings (runs every second)
  useEffect(() => {
    if (!data || data.day.status !== "active" || data.day.paused_at) return;
    const { day, tasks } = data;
    let timeIsUp = false;

    if (day.mode === "timer") {
      const running = tasks.find((t) => t.status === "running");
      if (running) {
        const left = taskRemainingSeconds(running, day, now);
        const key = `task-${running.id}-${running.started_at}`; // started_at changes on restart, so warnings fire again
        if (left > 0 && left <= RULES.taskWarningSeconds && !alreadyWarned.current.has(key)) {
          alreadyWarned.current.add(key);
          notify("warning", `${Math.ceil(left / 60)} min left`, `"${running.title}" is almost out of time`);
        }
        if (left === 0) timeIsUp = true;
      }
    }

    if (day.mode === "deadline") {
      const left = deadlineRemainingSeconds(day, now);
      if (left !== null) {
        for (const warnAt of RULES.deadlineWarningSeconds) {
          const key = `deadline-${day.id}-${day.started_at}-${warnAt}`;
          if (left > 0 && left <= warnAt && !alreadyWarned.current.has(key)) {
            alreadyWarned.current.add(key);
            const tasksLeft = tasks.filter((t) => t.status === "planned" && !t.is_break).length;
            notify("warning", `${warnAt / 60} min until the deadline`, `${tasksLeft} task(s) still to do`);
          }
        }
        if (left === 0) timeIsUp = true;
      }
    }

    // Time ran out: the SERVER decides what happens (at most once every 5 s)
    if (timeIsUp && now - lastCheckAt.current > 5000) {
      lastCheckAt.current = now;

      async function checkWithServer() {
        try {
          const res = await api.post<DayResponse>(`/days/${day.id}/check`);
          onUpdate(res.data);
        } catch (error) {
          notify("danger", "Couldn't check the timers", errorMessage(error));
        }
      }
      checkWithServer();
    }
  }, [data, now]);

  // 2) Notifications for things that changed after a server response
  useEffect(() => {
    const before = previous.current;
    previous.current = data;
    if (!data || !before || before.day.id !== data.day.id) return;

    const oldTasks = new Map<number, Task>(before.tasks.map((t) => [t.id, t]));
    for (const task of data.tasks) {
      const old = oldTasks.get(task.id);
      if (!old || old.status === task.status) continue;

      if (task.status === "running") {
        notify("info", `Now: ${task.title}`, `${task.duration_minutes} min on the clock`);
      }
      if (task.status === "missed") {
        notify("danger", `Missed: ${task.title}`, "This task didn't get finished in time");
      }
    }

    if (before.day.status === "active" && data.day.status !== "active") {
      if (data.day.status === "done") notify("success", "Day complete!", "You finished everything you planned.");
      if (data.day.status === "failed") notify("danger", "Day ended", "Some tasks were missed. Tomorrow is a new start.");
      if (data.day.status === "excused") notify("info", "Day excused", "Ended during an emergency. No penalty.");
    }

    const wasUnlocked = before.status.flexible.unlocked;
    const isUnlocked = data.status.flexible.unlocked;
    if (!wasUnlocked && isUnlocked) {
      notify("success", "Flexible mode unlocked!", "You've earned days without timers.");
    }
    if (wasUnlocked && !isUnlocked) {
      const why = data.status.flexible.bad_week
        ? `${data.status.flexible.missed_this_week} missed tasks this week. It unlocks again as they get older than 7 days.`
        : `Get back to Level ${data.status.flexible.level_needed} to unlock it again.`;
      notify("warning", "Flexible mode locked", why);
    }
  }, [data]);
}
