"use client";

import { useState } from "react";
import type { BucketItem } from "@productivity/shared";
import { CalendarDays, ChevronDown, StickyNote } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { BucketItemCard } from "./BucketItemCard";

interface Props {
  items: BucketItem[];
  today: string;
  onRemove: (item: BucketItem) => void;
  onDetailsSaved: (item: BucketItem, details: string) => void;
}

// The items in the bucket, split into two groups:
// scheduled tasks first (they were planned for today, so they matter more), then regular notes.
// Click a group's header to fold it closed / open.
// Used by the bucket drawer (Main tab) and the bucket box (Notes tab).
export function BucketList({ items, today, onRemove, onDetailsSaved }: Props) {
  const [closedGroups, setClosedGroups] = useState<string[]>([]); // labels of the folded groups

  const scheduled = items.filter((item) => item.source === "scheduled");
  const regular = items.filter((item) => item.source === "note");

  const groups = [
    { label: "Scheduled", Icon: CalendarDays, items: scheduled },
    { label: "Regular", Icon: StickyNote, items: regular },
  ];

  function toggleGroup(label: string) {
    setClosedGroups(closedGroups.includes(label) ? closedGroups.filter((l) => l !== label) : [...closedGroups, label]);
  }

  return (
    <div className="flex flex-col gap-3">
      {groups
        .filter((group) => group.items.length > 0) // hide a group with nothing in it
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
