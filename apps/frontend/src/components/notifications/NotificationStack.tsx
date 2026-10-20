"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNotifications, type NotificationKind } from "./NotificationProvider";

const kindStyles: Record<NotificationKind, string> = {
  info: "border-l-accent",
  warning: "border-l-amber-500",
  danger: "border-l-red-500",
  success: "border-l-emerald-500",
};

const kindDot: Record<NotificationKind, string> = {
  info: "bg-accent",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  success: "bg-emerald-500",
};

// The right column. Notifications stack from the BOTTOM:
// a new one slides up from below and pushes the older ones up.
export function NotificationStack() {
  const { notifications, dismiss, clearAll } = useNotifications();
  const scrollRef = useRef<HTMLDivElement>(null);

  // When a new notification arrives, scroll to the bottom so it's visible
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [notifications.length]);

  return (
    <aside className="flex h-screen w-80 shrink-0 flex-col border-l border-line bg-surface/60">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Notifications</h2>
        {notifications.length > 0 && (
          <button onClick={clearAll} className="text-xs text-muted hover:text-ink">
            Clear all
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 pb-3 [scrollbar-gutter:stable]">
        {/* mt-auto pushes the whole stack to the bottom of the column */}
        <div className="mt-auto flex flex-col">
          {notifications.length === 0 && <p className="py-6 text-center text-xs text-muted">No notifications yet</p>}

          <AnimatePresence initial={false}>
            {notifications.map((n) => (
              // The outer "slot" grows from 0 to the card's height, which smoothly pushes the older
              // notifications up. It clips its contents, so the sliding card can never stick out
              // of the column (that's what used to make scrollbars flash).
              <motion.div
                key={n.id}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="shrink-0 overflow-hidden"
              >
                <motion.div
                  initial={{ y: 40 }} // the new card starts a bit lower...
                  animate={{ y: 0 }} // ...and slides up into its slot
                  exit={{ x: 120 }} // a dismissed card slides out to the right
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className={`mt-2 rounded-lg border border-l-4 border-line bg-surface p-3 shadow-sm ${kindStyles[n.kind]}`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${kindDot[n.kind]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{n.title}</p>
                      {n.message && <p className="mt-0.5 text-xs text-muted">{n.message}</p>}

                      {n.actions && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {n.actions.map((action) => (
                            <button
                              key={action.label}
                              onClick={() => {
                                action.onClick();
                                dismiss(n.id);
                              }}
                              className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}

                      <p className="mt-1 text-[11px] text-muted">
                        {n.time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    <button onClick={() => dismiss(n.id)} className="text-muted hover:text-ink" aria-label="Dismiss notification">
                      ×
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}
