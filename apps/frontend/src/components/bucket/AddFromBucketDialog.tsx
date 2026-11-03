"use client";

import { useState } from "react";
import type { BucketItem } from "@productivity/shared";
import { HoloButton } from "@/components/common/HoloButton";

interface Props {
  item: BucketItem;
  minutesOptional: boolean; // deadline and flexible mode don't need minutes
  onAdd: (minutes: number | null) => void;
  onCancel: () => void;
}

// Pops up after you drop a bucket item on your plan, to ask how long it takes.
export function AddFromBucketDialog({ item, minutesOptional, onAdd, onCancel }: Props) {
  const [minutes, setMinutes] = useState(String(item.duration_minutes ?? (minutesOptional ? "" : 30))); // "" = no time

  return (
    <div
      data-keep-bucket-open // clicking here shouldn't close the bucket drawer behind it
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()} // clicking inside the box shouldn't close it
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(minutes === "" ? null : Number(minutes));
        }}
        className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-xl"
      >
        <h2 className="text-base font-semibold">Add to your plan</h2>
        <p className="mt-1 text-sm text-muted">&quot;{item.title}&quot;</p>

        <label className="mt-4 flex flex-col gap-1 text-xs text-muted">
          {minutesOptional ? "How many minutes? (optional)" : "How many minutes?"}
          <input
            type="number"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder={minutesOptional ? "No time" : ""}
            required={!minutesOptional}
            autoFocus
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-subtle">
            Cancel
          </button>
          <HoloButton type="submit">
            Add task
          </HoloButton>
        </div>
      </form>
    </div>
  );
}
