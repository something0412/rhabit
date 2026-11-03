"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

interface Props {
  value: string; // "18:30" (24-hour, like <input type="time">), or "" for no time
  onChange: (value: string) => void;
  clearable?: boolean; // show a "Clear" button (only where a time is optional)
  minuteStep?: number; // e.g. 5 -> 00, 05, 10, ...
  ariaLabel?: string;
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const PERIODS = ["AM", "PM"] as const;
type Period = (typeof PERIODS)[number];

// "18:30" -> { hour: 6, minute: 30, period: "PM" }   (12-hour pieces for the columns)
function toParts(value: string) {
  const [h, m] = (value || "09:00").split(":").map(Number);
  return { hour: h % 12 || 12, minute: m, period: (h < 12 ? "AM" : "PM") as Period };
}

// { hour: 6, minute: 30, period: "PM" } -> "18:30"   (back to 24-hour for saving)
function fromParts(hour: number, minute: number, period: Period): string {
  const h = (hour % 12) + (period === "PM" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// A time picker (look based on reUI's Time Picker; our own code). The button shows "6:30 PM";
// clicking it opens scrolling Hour / Minute / AM-PM columns. The value stays 24-hour "18:30",
// so the backend gets the same format as before. Only the display is 12-hour.
export function TimePicker({ value, onChange, clearable = false, minuteStep = 1, ariaLabel = "Time" }: Props) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { hour, minute, period } = toParts(value);
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);

  // Clicking outside or pressing Esc closes it
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // When it opens, scroll each column so the chosen value sits in the middle
  useEffect(() => {
    if (!open || !panelRef.current) return;
    for (const picked of panelRef.current.querySelectorAll<HTMLElement>("[aria-pressed='true']")) {
      const column = picked.parentElement!;
      column.scrollTop = picked.offsetTop - (column.clientHeight - picked.offsetHeight) / 2;
    }
  }, [open]);

  function pickNow() {
    const now = new Date();
    const roundedMinute = Math.round(now.getMinutes() / minuteStep) * minuteStep;
    now.setMinutes(roundedMinute); // 60 rolls over to the next hour by itself
    onChange(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  }

  const shown = value ? `${hour}:${String(minute).padStart(2, "0")} ${period}` : "--:-- --";

  // One scrolling column of choices
  function column<T extends string | number>(title: string, items: readonly T[], current: T, label: (item: T) => string, pick: (item: T) => void) {
    return (
      <div className="flex w-14 flex-col">
        <p className="pb-1 text-center text-[11px] text-muted">{title}</p>
        {/* scrollbarWidth "none": hide the scrollbar (set here because globals.css gives every element a thin one) */}
        <div className="relative flex h-40 flex-col gap-0.5 overflow-y-auto px-1" style={{ scrollbarWidth: "none" }}>
          {items.map((item) => {
            const picked = value !== "" && item === current;
            return (
              <button
                key={String(item)}
                type="button"
                aria-pressed={picked}
                onClick={() => pick(item)}
                className={`shrink-0 rounded-md py-1.5 text-sm tabular-nums transition-colors ${
                  picked ? "bg-accent-soft font-semibold text-accent-ink" : "text-muted hover:bg-subtle hover:text-ink"
                }`}
              >
                {label(item)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`${ariaLabel}: ${value ? shown : "not set"}`}
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-md border bg-surface px-3 py-1.5 text-sm tabular-nums transition-colors hover:bg-subtle ${
          open ? "border-accent" : "border-line"
        } ${value ? "text-ink" : "text-muted"}`}
      >
        <Clock className="h-4 w-4 text-muted" aria-hidden />
        {shown}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`Pick ${ariaLabel.toLowerCase()}`}
          className="absolute top-full left-0 z-30 mt-1 rounded-xl border border-line bg-surface p-2 shadow-xl"
        >
          <div className="flex divide-x divide-line">
            {column("Hour", HOURS, hour, (h) => String(h), (h) => onChange(fromParts(h, minute, period)))}
            {column("Minute", minutes, minute, (m) => String(m).padStart(2, "0"), (m) => onChange(fromParts(hour, m, period)))}
            {column("", PERIODS, period, (p) => p, (p) => onChange(fromParts(hour, minute, p)))}
          </div>

          <div className="mt-2 flex border-t border-line pt-2 text-sm">
            <button type="button" onClick={pickNow} className="flex-1 rounded-md py-1 font-medium text-ink hover:bg-subtle">
              Now
            </button>
            {clearable && (
              <button type="button" onClick={() => onChange("")} className="flex-1 rounded-md py-1 text-muted hover:bg-subtle hover:text-ink">
                Clear
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-md py-1 text-accent-ink hover:bg-subtle">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
