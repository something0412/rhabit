"use client";

import { useState } from "react";

// The little arrow that opens/closes a task's details.
// (No "has details" dot on purpose: it annoyed users. Tasks show a short preview of their details instead.)
export function DetailsArrow({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? "Hide details" : "Show details"}
      aria-expanded={open}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-ink"
    >
      <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} fill="currentColor">
        <path d="M7 5l6 5-6 5V5z" />
      </svg>
    </button>
  );
}

// The dropdown area: a text box for extra explanation, e.g. "whites only, cold water".
// It saves when you click away (only if you changed something).
export function DetailsBox({ value, onSave }: { value: string; onSave: (details: string) => void }) {
  const [text, setText] = useState(value);

  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== value) onSave(text);
      }}
      placeholder="Add details... (saves when you click away)"
      rows={2}
      autoFocus={!value}
      className="mt-2 w-full resize-y rounded-md border border-line bg-subtle px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
    />
  );
}
