"use client";

import { useEffect, useRef, useState } from "react";
import { RULES } from "@productivity/shared";
import { HoloButton } from "@/components/common/HoloButton";

const AUTO_CONFIRM_SECONDS = 10;

interface Props {
  freeStopsLeft: number;
  cost: string; // e.g. "20 coins" or "10 XP" (only used when no free stops are left)
  onConfirm: () => void;
  onCancel: () => void;
}

// "Are you sure?" before an emergency stop.
// In a real emergency there may be no time to answer, so after 10 seconds it stops anyway.
export function EmergencyStopDialog({ freeStopsLeft, cost, onConfirm, onCancel }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CONFIRM_SECONDS);
  const confirmed = useRef(false); // so the stop is only sent once (button click OR countdown)

  function confirm() {
    if (confirmed.current) return;
    confirmed.current = true;
    onConfirm();
  }

  // Count down once per second
  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // Time's up: apply the emergency stop
  useEffect(() => {
    if (secondsLeft === 0) confirm();
  });

  const isFree = freeStopsLeft > 0;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()} // clicking inside the box shouldn't close it
        className="w-full max-w-sm rounded-xl border border-red-500/40 bg-surface p-5 shadow-xl"
      >
        <h2 className="text-base font-semibold text-red-600 dark:text-red-400">Emergency stop?</h2>

        {isFree ? (
          <p className="mt-2 text-sm text-ink">
            This uses 1 of your {freeStopsLeft} free emergency stop{freeStopsLeft === 1 ? "" : "s"} left this week (of{" "}
            {RULES.emergencyStopsPerWeek}). Everything freezes until you press Continue.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink">
              You&apos;ve used all {RULES.emergencyStopsPerWeek} free emergency stops this week. This one costs{" "}
              <span className="font-semibold text-red-600 dark:text-red-400">{cost}</span>.
            </p>
            <p className="mt-2 text-xs text-muted">
              If you end the day during this stop, unfinished tasks still count as missed, but they only cost XP.
            </p>
          </>
        )}

        <p className="mt-4 text-xs text-muted">
          Stopping automatically in <span className="font-mono font-semibold text-ink">{secondsLeft}s</span>
        </p>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-subtle">
          <div
            className="h-full bg-red-500 transition-[width] duration-1000 ease-linear"
            style={{ width: `${(secondsLeft / AUTO_CONFIRM_SECONDS) * 100}%` }}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-subtle">
            Cancel
          </button>
          <HoloButton onClick={confirm} autoFocus tone="danger">
            Stop now
          </HoloButton>
        </div>
      </div>
    </div>
  );
}
