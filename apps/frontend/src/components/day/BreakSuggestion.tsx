"use client";

import type { DayResponse } from "@productivity/shared";
import { RULES } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { useNotifications } from "@/components/notifications/NotificationProvider";

interface Props {
  dayId: number;
  afterTaskId: number;
  minutesInARow: number;
  onDismiss: () => void;
  onUpdate: (data: DayResponse) => void;
}

// The faded "ghost" row that suggests a break. It's NOT a real task until you press Add.
// (Rule-based for now. Later, the AI assistant can make these suggestions smarter.)
export function BreakSuggestion({ dayId, afterTaskId, minutesInARow, onDismiss, onUpdate }: Props) {
  const { notify } = useNotifications();

  async function addBreak() {
    try {
      const res = await api.post<DayResponse>(`/days/${dayId}/tasks`, {
        title: "Break",
        duration_minutes: RULES.breakSuggestLengthMinutes,
        is_break: true,
        after_task_id: afterTaskId,
      });
      onUpdate(res.data);
    } catch (error) {
      notify("danger", "Couldn't add the break", errorMessage(error));
    }
  }

  return (
    <li className="group flex items-center gap-3 rounded-lg border border-dashed border-violet-300 bg-violet-500/10 p-3 opacity-75 transition hover:opacity-100">
      <span className="w-5" />
      <div className="min-w-0 flex-1 blur-[1px] transition group-hover:blur-none">
        <p className="text-sm font-medium text-violet-800">{RULES.breakSuggestLengthMinutes} min break</p>
        <p className="text-xs text-violet-600">
          Suggested by your assistant · {Math.floor(minutesInARow / 60)}h {minutesInARow % 60}m of tasks in a row
        </p>
      </div>
      <button onClick={addBreak} className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:opacity-90">
        Add
      </button>
      <button onClick={onDismiss} className="rounded-md px-2 py-1 text-xs text-violet-600 hover:bg-violet-500/15">
        Dismiss
      </button>
    </li>
  );
}
