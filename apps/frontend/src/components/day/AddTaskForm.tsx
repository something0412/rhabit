"use client";

import { useState } from "react";
import type { DayResponse } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { HoloButton } from "@/components/common/HoloButton";

interface Props {
  dayId: number;
  minutesOptional: boolean; // deadline and flexible mode don't need minutes
  onUpdate: (data: DayResponse) => void;
}

export function AddTaskForm({ dayId, minutesOptional, onUpdate }: Props) {
  const { notify } = useNotifications();
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(minutesOptional ? "" : "30"); // "" = no time set
  const [isBreak, setIsBreak] = useState(false);
  const [saving, setSaving] = useState(false);

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await api.post<DayResponse>(`/days/${dayId}/tasks`, {
        title,
        duration_minutes: minutes === "" ? null : Number(minutes),
        is_break: isBreak,
      });
      onUpdate(res.data);
      setTitle("");
      setIsBreak(false);
    } catch (error) {
      notify("danger", "Couldn't add task", errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={addTask} className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted">
        Task
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isBreak ? "Lunch break" : "e.g. Cooking"}
          className="rounded-md border border-line px-3 py-2 text-sm text-ink"
          required
        />
      </label>

      <label className="flex w-32 flex-col gap-1 text-xs text-muted">
        {minutesOptional ? "Minutes (optional)" : "Minutes"}
        <input
          type="number"
          min={1}
          max={1440}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder={minutesOptional ? "No time" : ""}
          className="rounded-md border border-line px-3 py-2 text-sm text-ink"
          required={!minutesOptional}
        />
      </label>

      <label className="flex items-center gap-2 pb-2 text-sm text-muted">
        <input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} />
        Break
      </label>

      <HoloButton
        type="submit"
        disabled={saving}
      >
        Add
      </HoloButton>
    </form>
  );
}
