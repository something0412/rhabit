"use client";

import { AnimatePresence, motion } from "motion/react";
import type { BucketItem } from "@productivity/shared";
import { BucketItemCard } from "./BucketItemCard";

interface Props {
  open: boolean;
  items: BucketItem[];
  today: string;
  onClose: () => void;
  onRemove: (item: BucketItem) => void;
  onDetailsSaved: (item: BucketItem, details: string) => void;
}

// The panel that slides out on the Main tab. Drag an item from here onto your plan.
// (right-80 = it sits just left of the notification column)
export function BucketDrawer({ open, items, today, onClose, onRemove, onDetailsSaved }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="fixed top-0 right-80 bottom-0 z-20 flex w-72 flex-col border-l border-line bg-surface shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">🪣 To-do bucket</h2>
              <p className="text-[11px] text-muted">Drag an item onto your plan</p>
            </div>
            <button onClick={onClose} aria-label="Close bucket" className="rounded-md px-2 text-lg text-muted hover:bg-subtle">
              ×
            </button>
          </div>

          <div className="flex-1 overflow-x-hidden overflow-y-auto p-3 [scrollbar-gutter:stable]">
            {items.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted">
                Empty. Drag notes into the bucket on the Notes tab, or schedule tasks on the Scheduler tab.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <BucketItemCard
                    key={`${item.source}-${item.id}`}
                    item={item}
                    today={today}
                    onRemove={onRemove}
                    onDetailsSaved={onDetailsSaved}
                  />
                ))}
              </ul>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
