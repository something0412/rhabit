"use client";

import { useEffect, useState } from "react";
import { CardIcon } from "@/components/common/CardIcon";
import { Lock } from "lucide-react";
import type { Profile, ProfileResponse } from "@productivity/shared";
import { RULES, STORE_ITEMS } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { formatReward } from "@/lib/rewards";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { usePlayer } from "@/components/player/PlayerProvider";
import { HoloButton } from "@/components/common/HoloButton";
import { TimePicker } from "@/components/common/TimePicker";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ProfilePage() {
  const { notify } = useNotifications();
  const { setPlayer } = usePlayer();
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loadError, setLoadError] = useState("");

  // form fields
  const [name, setName] = useState("");
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("17:00");
  const [workDays, setWorkDays] = useState<number[]>([]);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.get<ProfileResponse>("/me");
        setData(res.data);
        setPlayer(res.data.profile, res.data.status);
        setName(res.data.profile.display_name);
        setWorkStart(res.data.profile.work_start);
        setWorkEnd(res.data.profile.work_end);
        setWorkDays(res.data.profile.work_days);
      } catch (error) {
        setLoadError(errorMessage(error));
      }
    }
    loadProfile();
  }, []);

  // After saving, keep the page and the sidebar in sync with the new profile
  function profileSaved(profile: Profile) {
    if (!data) return;
    setData({ ...data, profile });
    setPlayer(profile, data.status);
  }

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    try {
      const res = await api.patch<Profile>("/me", { display_name: name });
      profileSaved(res.data);
      notify("success", "Name saved");
    } catch (error) {
      notify("danger", "Couldn't save name", errorMessage(error));
    }
  }

  async function saveWorkHours(event: React.FormEvent) {
    event.preventDefault();
    try {
      const res = await api.patch<Profile>("/me", { work_start: workStart, work_end: workEnd, work_days: workDays });
      profileSaved(res.data);
      notify("success", "Work hours saved", "Reminders will only come during these hours.");
    } catch (error) {
      notify("danger", "Couldn't save work hours", errorMessage(error));
    }
  }

  function toggleDay(day: number) {
    setWorkDays(workDays.includes(day) ? workDays.filter((d) => d !== day) : [...workDays, day].sort());
  }

  if (loadError) {
    return <p className="m-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">{loadError}</p>;
  }
  if (!data) return <p className="p-6 text-sm text-muted">Loading...</p>;

  const { profile, status, reward_events, days_off_taken } = data;
  const cards = STORE_ITEMS.filter((item) => item.kind === "card");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Profile</h1>

      {/* ----- stats ----- */}
      <section className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Level</p>
          <p className="mt-1 text-3xl font-semibold">{status.level.level}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle">
            <div className="h-full bg-accent" style={{ width: `${(status.level.xp_into_level / status.level.xp_for_next) * 100}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {profile.xp} XP total · {status.level.xp_for_next - status.level.xp_into_level} to next
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Coins</p>
          <p className="mt-1 text-3xl font-semibold text-amber-600 dark:text-amber-400">🪙 {profile.coins}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Days off</p>
          <p className="mt-1 text-3xl font-semibold">{status.inventory.day_off_card ?? 0}</p>
          <p className="text-[11px] text-muted">cards left · {days_off_taken} taken</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Emergency stops</p>
          <p className="mt-1 text-3xl font-semibold">{status.emergency_stops_left}</p>
          <p className="text-[11px] text-muted">left this week (of {RULES.emergencyStopsPerWeek})</p>
        </div>
      </section>

      {/* ----- flexible mode ----- */}
      <section className="rounded-xl border border-line bg-surface p-4 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          Flexible mode: {status.flexible.unlocked ? "Unlocked" : "Locked"}
          {!status.flexible.unlocked && <Lock className="h-3.5 w-3.5" aria-hidden />}
        </p>
        <p className="mt-1 text-xs text-muted">
          Unlocks at Level {status.flexible.level_needed}, and locks again while you have {RULES.badWeekMissedTasks}+ missed
          tasks in the last 7 days (you have {status.flexible.missed_this_week}). A Flexible Day card works even while it's
          locked.
        </p>
      </section>

      {/* ----- cards you own ----- */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Your cards</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 @2xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.id} className="flex items-center gap-2 rounded-lg bg-subtle p-2">
              <CardIcon name={card.icon} className="h-5 w-5 shrink-0 text-accent-ink" />
              <div>
                <p className="text-xs font-medium">{card.name}</p>
                <p className="text-xs text-muted">x {status.inventory[card.id] ?? 0}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ----- name ----- */}
      <form onSubmit={saveName} className="flex items-end gap-3 rounded-xl border border-line bg-surface p-4">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          Display name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>
        <HoloButton type="submit">
          Save
        </HoloButton>
      </form>

      {/* ----- work hours ----- */}
      <form onSubmit={saveWorkHours} className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Work hours</h2>
        <p className="text-xs text-muted">
          Automatic reminders (like &quot;Ready to start your day?&quot;) only come during these hours. Alerts for a task
          you already started always show.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1 text-xs text-muted">
            From
            <TimePicker value={workStart} onChange={setWorkStart} minuteStep={5} ariaLabel="Work starts" />
          </div>
          <div className="flex flex-col gap-1 text-xs text-muted">
            To
            <TimePicker value={workEnd} onChange={setWorkEnd} minuteStep={5} ariaLabel="Work ends" />
          </div>

          <div className="flex flex-col gap-1 text-xs text-muted">
            Days
            <div className="flex gap-1">
              {WEEKDAYS.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-md px-2 py-1.5 text-xs ${
                    workDays.includes(day) ? "bg-accent text-white" : "border border-line text-muted hover:bg-subtle"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <HoloButton type="submit">
            Save hours
          </HoloButton>
        </div>
      </form>

      {/* ----- history ----- */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">History</h2>
        {reward_events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing yet. Finish a task to earn XP and coins.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {reward_events.map((event) => {
              const amount = formatReward(event);
              const gained = event.xp > 0 || event.coins > 0;
              return (
                <li key={event.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <p>{event.reason}</p>
                    <p className="text-xs text-muted">{new Date(event.created_at).toLocaleString()}</p>
                  </div>
                  {amount && (
                    <span className={`shrink-0 font-medium ${gained ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{amount}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
