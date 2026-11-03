"use client";

import { useEffect, useRef } from "react";
import { Inbox, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { BucketItem } from "@productivity/shared";
import { BucketList } from "./BucketList";

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
  const drawerRef = useRef<HTMLElement>(null);

  // Click anywhere outside the drawer to close it.
  // Elements marked data-keep-bucket-open don't count (the Bucket button, the "how many minutes?" box).
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element;
      if (drawerRef.current?.contains(target)) return; // clicked inside the drawer
      if (target.closest("[data-keep-bucket-open]")) return;
      onClose();
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          ref={drawerRef}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="fixed top-0 right-80 bottom-0 z-20 flex w-72 flex-col border-l border-line bg-surface shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Inbox className="h-4 w-4" aria-hidden /> To-do bucket
              </h2>
              <p className="text-[11px] text-muted">Drag an item onto your plan</p>
            </div>
            <button onClick={onClose} aria-label="Close bucket" className="rounded-md px-2 text-lg text-muted hover:bg-subtle">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="flex-1 overflow-x-hidden overflow-y-auto p-3 [scrollbar-gutter:stable]">
            {items.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted">
                Empty. Drag notes into the bucket on the Notes tab, or schedule tasks on the Scheduler tab.
              </p>
            ) : (
              <BucketList items={items} today={today} onRemove={onRemove} onDetailsSaved={onDetailsSaved} />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
