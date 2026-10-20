"use client";

import { useEffect, useRef } from "react";
import type { DayResponse } from "@productivity/shared";
import { RULES, isWithinWorkHours, minutesOfDay } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { usePlayer } from "./PlayerProvider";

// Remember which reminders were already shown today (so a page reload doesn't repeat them)
function alreadySent(key: string, sentThisSession: Set<string>): boolean {
  try {
    return localStorage.getItem(key) === "sent" || sentThisSession.has(key);
  } catch {
    return sentThisSession.has(key);
  }
}

function markSent(key: string, sentThisSession: Set<string>) {
  sentThisSession.add(key);
  try {
    localStorage.setItem(key, "sent");
  } catch {
    // storage blocked: the in-memory set still prevents repeats until reload
  }
}

// Automatic reminders. They ONLY show during your work hours:
//  - at work start:              "Ready to start your day?"
//  - 1 hour later, still not started: "Still working today?"  [Start day] [Take a day off]
// (Alerts for a task you already started, like "5 min left", are separate and always show.)
//
// For now these appear while the app is open. Later, push notifications can send them
// even when the app is closed.
export function WorkReminders() {
  const { profile, setPlayer } = usePlayer();
  const { notify } = useNotifications();
  const sentThisSession = useRef(new Set<string>());

  useEffect(() => {
    if (!profile) return;
    const workProfile = profile;

    // The Main page listens for this, so it shows the change right away
    function shareUpdate(data: DayResponse) {
      setPlayer(data.profile, data.status);
      window.dispatchEvent(new CustomEvent<DayResponse>("day-updated", { detail: data }));
    }

    async function startDay(dayId: number) {
      try {
        const res = await api.post<DayResponse>(`/days/${dayId}/start`);
        shareUpdate(res.data);
        notify("success", "Day started", "Good luck!");
      } catch (error) {
        notify("danger", "Couldn't start the day", errorMessage(error));
      }
    }

    async function takeDayOff(dayId: number) {
      try {
        const res = await api.post<DayResponse>(`/days/${dayId}/day-off`);
        shareUpdate(res.data);
        notify("success", "Enjoy your day off", "No penalties and no reminders today.");
      } catch (error) {
        notify("danger", "Couldn't take a day off", errorMessage(error));
      }
    }

    async function checkReminders() {
      const now = new Date();
      if (!isWithinWorkHours(workProfile, now)) return; // outside work hours: stay quiet

      const minutesNow = now.getHours() * 60 + now.getMinutes();
      const isLate = minutesNow >= minutesOfDay(workProfile.work_start) + RULES.lateStartReminderMinutes;
      const key = `reminder-${isLate ? "late" : "start"}-${now.toDateString()}`;
      if (alreadySent(key, sentThisSession.current)) return;

      try {
        const res = await api.get<DayResponse>("/days/today");
        markSent(key, sentThisSession.current);
        const { day, tasks } = res.data;
        if (day.status !== "planning") return; // already started, finished, or a day off

        if (!isLate) {
          notify(
            "info",
            "Ready to start your day?",
            tasks.length > 0 ? `${tasks.length} task(s) planned.` : "Plan your tasks on the Main tab first.",
            tasks.length > 0 ? [{ label: "Start day", onClick: () => startDay(day.id) }] : undefined
          );
        } else {
          notify(
            "warning",
            "Still working today?",
            `Your work hours started at ${workProfile.work_start} and today hasn't started yet.`,
            [
              { label: "Start day", onClick: () => startDay(day.id) },
              { label: "Take a day off", onClick: () => takeDayOff(day.id) },
            ]
          );
        }
      } catch {
        // the API isn't reachable right now; try again next minute
      }
    }

    checkReminders();
    const interval = setInterval(checkReminders, 60_000);
    return () => clearInterval(interval);
  }, [profile?.work_start, profile?.work_end, profile?.work_days.join(",")]);

  return null; // nothing to show on screen, it only sends notifications
}
