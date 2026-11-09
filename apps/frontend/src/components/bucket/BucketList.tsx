"use client";

import { useState } from "react";
import type { BucketItem } from "@productivity/shared";
import { CalendarClock, CalendarDays, ChevronDown, History, StickyNote } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { BucketItemCard } from "./BucketItemCard";

interface Props {
  items: BucketItem[];
  today: string;
  onRemove: (item: BucketItem) => void;
  onDetailsSaved: (item: BucketItem, details: string) => void;
}

// The items in the bucket, split into groups:
//  - Scheduled: scheduled tasks for TODAY (always shown, even when empty)
//  - From previous days: tasks you missed in the last 7 days, to try again
//  - Regular: notes dragged into the bucket
//  - Past scheduled: scheduled tasks from the last 7 days you never added (starts folded)
// After 7 days, past things drop out of the bucket (the server stops sending them).
// Click a group's header to fold it closed / open.
// Used by the bucket drawer (Main tab) and the bucket box (Notes tab).
export function BucketList({ items, today, onRemove, onDetailsSaved }: Props) {
  const [closedGroups, setClosedGroups] = useState<string[]>(["Past scheduled"]); // labels of the folded groups

  const scheduledItems = items.filter((item) => item.source === "scheduled");
  const scheduled = scheduledItems.filter((item) => (item.date ?? today) >= today);
  const pastScheduled = scheduledItems.filter((item) => (item.date ?? today) < today).reverse(); // newest first
  const missed = items.filter((item) => item.source === "missed");
  const regular = items.filter((item) => item.source === "note");

  const groups = [
    // alwaysShow: "Scheduled" stays even when empty, so it's clear nothing is scheduled for today
    { label: "Scheduled", Icon: CalendarDays, items: scheduled, alwaysShow: true, emptyText: "No scheduled tasks for today." },
    { label: "From previous days", Icon: History, items: missed, alwaysShow: false, emptyText: "" },
    { label: "Regular", Icon: StickyNote, items: regular, alwaysShow: false, emptyText: "" },
    { label: "Past scheduled", Icon: CalendarClock, items: pastScheduled, alwaysShow: false, emptyText: "" },
  ];

  function toggleGroup(label: string) {
    setClosedGroups(closedGroups.includes(label) ? closedGroups.filter((l) => l !== label) : [...closedGroups, label]);
  }

  return (
    <div className="flex flex-col gap-3">
      {groups
        .filter((group) => group.alwaysShow || group.items.length > 0) // hide an empty group (except Scheduled)
        .map((group) => {
          const open = !closedGroups.includes(group.label);
          return (
            <div key={group.label}>
              {/* the header: the group name with a line after it. Click to fold/unfold. */}
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 rounded-md text-[11px] font-medium text-muted hover:text-ink"
              >
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden />
                <span className="flex items-center gap-1">
                  <group.Icon className="h-3.5 w-3.5" aria-hidden /> {group.label} ({group.items.length})
                </span>
                <span className="h-px flex-1 bg-line" />
              </button>

              {/* the items, sliding open/closed. initial={false}: no animation when the page loads */}
              <AnimatePresence initial={false}>
                {open && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex flex-col gap-2 overflow-hidden pt-2"
                  >
                    {group.items.length === 0 && <li className="px-1 text-xs text-muted">{group.emptyText}</li>}
                    {group.items.map((item) => (
                      <BucketItemCard
                        key={`${item.source}-${item.id}`}
                        item={item}
                        today={today}
                        onRemove={onRemove}
                        onDetailsSaved={onDetailsSaved}
                      />
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
    </div>
  );
}
