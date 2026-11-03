"use client";

import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import type { AddFromBucketResponse, BucketItem, DayResponse } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { rewardNotification } from "@/lib/rewards";
import { getCurrentDrag, isOurDrag, readDragData } from "@/lib/dragData";
import { localDate } from "@/lib/dates";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { usePlayer } from "@/components/player/PlayerProvider";
import { DayControls } from "@/components/day/DayControls";
import { ModePicker } from "@/components/day/ModePicker";
import { TaskList } from "@/components/day/TaskList";
import { AddTaskForm } from "@/components/day/AddTaskForm";
import { useDayAlerts } from "@/components/day/useDayAlerts";
import { BucketDrawer } from "@/components/bucket/BucketDrawer";
import { AddFromBucketDialog } from "@/components/bucket/AddFromBucketDialog";

// Has the bucket already opened by itself? This lives outside the component, so it survives
// switching tabs (the page is rebuilt) and only resets when the whole app is reloaded.
let bucketAutoOpened = false;

export default function MainPage() {
  const { notify } = useNotifications();
  const { setPlayer } = usePlayer();
  const [which, setWhich] = useState<"today" | "tomorrow">("today");
  const [data, setData] = useState<DayResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true); // waiting for the plan after switching Today/Tomorrow
  const [now, setNow] = useState(() => Date.now());

  // the to-do bucket
  const [bucket, setBucket] = useState<BucketItem[]>([]);
  const [bucketOpen, setBucketOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // a bucket item that was dropped, waiting for "how many minutes?" (insertAt = its spot in the list)
  const [dropped, setDropped] = useState<{ item: BucketItem; insertAt: number } | null>(null);

  // Every API call returns the whole updated day. This saves it,
  // updates XP/coins in the sidebar, and shows a notification for every reward or penalty.
  function handleUpdate(next: DayResponse) {
    setData(next);
    setPlayer(next.profile, next.status);
    for (const event of next.reward_changes) {
      const n = rewardNotification(event);
      notify(n.kind, n.title, n.message);
    }
  }

  // Load the plan when the page opens, and when switching Today/Tomorrow.
  // The old plan stays on screen (faded) until the new one arrives, so the page doesn't jump.
  useEffect(() => {
    let switchedAway = false; // set when you switch again before this answer arrives

    async function loadDay() {
      setLoading(true);
      setLoadError("");
      try {
        const res = await api.get<DayResponse>(`/days/${which}`);
        if (switchedAway) return; // too late: you're looking at the other day now
        handleUpdate(res.data);
      } catch (error) {
        if (switchedAway) return;
        setData(null);
        setLoadError(errorMessage(error));
      }
      setLoading(false);
    }
    loadDay();

    return () => {
      switchedAway = true;
    };
  }, [which]);

  // Load the bucket once. If scheduled tasks are due today, say so (once per day).
  useEffect(() => {
    async function loadBucket() {
      try {
        const res = await api.get<BucketItem[]>("/bucket");
        setBucket(res.data);
        // Open it automatically when something is waiting, but only the first time you visit Main.
        // After that it stays closed until you open it (switching tabs doesn't pop it open again).
        if (!bucketAutoOpened && res.data.length > 0) {
          bucketAutoOpened = true;
          setBucketOpen(true);
        }

        const dueCount = res.data.filter((item) => item.source === "scheduled").length;
        const noticeKey = `scheduled-notice-${localDate()}`;
        let alreadyShown = false;
        try {
          alreadyShown = localStorage.getItem(noticeKey) === "shown";
          localStorage.setItem(noticeKey, "shown");
        } catch {
          // storage blocked: just show it
        }

        if (dueCount > 0 && !alreadyShown) {
          notify("info", `${dueCount} scheduled task(s) for today`, "They're waiting in your to-do bucket.", [
            { label: "Open bucket", onClick: () => setBucketOpen(true) },
          ]);
        }
      } catch {
        // the plan's own error message already covers an unreachable API
      }
    }
    loadBucket();
  }, []);

  // A work-hours reminder button (Start day / Take a day off) changed today's plan
  useEffect(() => {
    function onDayUpdated(event: Event) {
      if (which === "today") setData((event as CustomEvent<DayResponse>).detail);
    }
    window.addEventListener("day-updated", onDayUpdated);
    return () => window.removeEventListener("day-updated", onDayUpdated);
  }, [which]);

  // Tick every second so the countdowns update
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useDayAlerts(data, now, handleUpdate);

  // ----- drag from the bucket onto the plan -----
  const canEditTasks = data !== null && (data.day.status === "planning" || data.day.status === "active");

  // A bucket item was dropped at a spot in the list (or below it = at the end).
  // This opens the "how many minutes?" dialog.
  function bucketItemDropped(dragged: { source: BucketItem["source"]; id: number }, insertAt: number) {
    const item = bucket.find((b) => b.source === dragged.source && b.id === dragged.id);
    if (item) setDropped({ item, insertAt });
  }

  // Dropped somewhere in the plan area that isn't on the list itself (e.g. an empty plan)
  function dropOnPlan(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const dragged = readDragData(event);
    if (dragged?.kind === "bucket" && data) bucketItemDropped(dragged, data.tasks.length);
  }

  async function addFromBucket(item: BucketItem, minutes: number | null, insertAt: number) {
    if (!data) return;
    try {
      const res = await api.post<AddFromBucketResponse>("/bucket/add-to-day", {
        source: item.source,
        id: item.id,
        day_id: data.day.id,
        duration_minutes: minutes,
        insert_at: insertAt,
      });
      handleUpdate(res.data.day);
      setBucket(res.data.bucket);
      if (res.data.bucket.length === 0) setBucketOpen(false); // that was the last one
      setDropped(null);
      const length = minutes === null ? "No time set" : `${minutes} min`;
      notify("success", `Added "${item.title}"`, `${length}, as task #${insertAt + 1} in your plan.`);
    } catch (error) {
      notify("danger", "Couldn't add it to your plan", errorMessage(error));
    }
  }

  async function removeFromBucket(item: BucketItem) {
    try {
      const res = await api.post<BucketItem[]>("/bucket/remove", { source: item.source, id: item.id });
      setBucket(res.data);
      if (res.data.length === 0) setBucketOpen(false); // that was the last one
    } catch (error) {
      notify("danger", "Couldn't remove it", errorMessage(error));
    }
  }

  // A task was deleted from the plan. If it came from the Scheduler, the server puts it back in the
  // bucket (and a note goes back to the Notes list), so ask for the fresh bucket right away.
  async function reloadBucketAfterDelete() {
    try {
      const res = await api.get<BucketItem[]>("/bucket");
      if (res.data.length > bucket.length) notify("info", "Back in your bucket", "The deleted task can be added again from the bucket.");
      setBucket(res.data);
    } catch {
      // not important enough for an error: the bucket refreshes next time the page loads
    }
  }

  function bucketDetailsSaved(item: BucketItem, details: string) {
    setBucket(bucket.map((b) => (b.source === item.source && b.id === item.id ? { ...b, details } : b)));
  }

  const dateLabel = data
    ? new Date(`${data.day.date}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    : "";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Plan your day</h1>
          <p className="text-sm text-muted">{dateLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            data-keep-bucket-open // this button opens AND closes it, so "click outside" shouldn't also fire
            onClick={() => setBucketOpen(!bucketOpen)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
              bucketOpen ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface hover:bg-subtle"
            }`}
          >
            <Inbox className="h-4 w-4" aria-hidden /> Bucket {bucket.length > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-xs text-white">{bucket.length}</span>}
          </button>

          <div className="flex rounded-lg border border-line bg-surface p-0.5 text-sm">
            {(["today", "tomorrow"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setWhich(option)}
                className={`rounded-md px-3 py-1 capitalize ${which === option ? "bg-accent text-white" : "text-muted"}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </header>

      {loadError && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">{loadError}</p>}

      {!data && !loadError && <p className="text-sm text-muted">Loading...</p>}

      {data && (
        // While the other day loads: faded and not clickable, so you can't press buttons on the wrong day.
        // key = a fresh start for each day (half-typed tasks, open edits don't carry over to the other day)
        <div
          key={data.day.id}
          className={`flex flex-col gap-4 transition-opacity ${loading ? "pointer-events-none opacity-50" : ""}`}>
          <DayControls data={data} now={now} isToday={which === "today"} onUpdate={handleUpdate} />
          {data.day.status === "planning" && <ModePicker data={data} onUpdate={handleUpdate} />}

          {/* The task list handles drops between tasks itself.
              This outer area only catches a bucket item dropped on an EMPTY plan. */}
          {data.day.status !== "day_off" && (
            <div
              onDragOver={(e) => {
                const isBucketItem = isOurDrag(e) && getCurrentDrag()?.kind === "bucket";
                if (!canEditTasks || data.tasks.length > 0 || !isBucketItem) return;
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
              }}
              onDrop={dropOnPlan}
              className={`rounded-xl transition ${dragOver ? "bg-accent-soft outline-2 outline-dashed outline-offset-4 outline-accent" : ""}`}
            >
              <TaskList
                data={data}
                now={now}
                onUpdate={handleUpdate}
                onBucketDrop={bucketItemDropped}
                onTaskDeleted={reloadBucketAfterDelete}
              />
              {dragOver && <p className="py-3 text-center text-sm font-medium text-accent-ink">Drop to add it to your plan</p>}
            </div>
          )}

          {canEditTasks && <AddTaskForm dayId={data.day.id} minutesOptional={data.day.mode !== "timer"} onUpdate={handleUpdate} />}
        </div>
      )}

      <BucketDrawer
        open={bucketOpen}
        items={bucket}
        today={localDate()}
        onClose={() => setBucketOpen(false)}
        onRemove={removeFromBucket}
        onDetailsSaved={bucketDetailsSaved}
      />

      {dropped && (
        <AddFromBucketDialog
          item={dropped.item}
          minutesOptional={data?.day.mode !== "timer"}
          onAdd={(minutes) => addFromBucket(dropped.item, minutes, dropped.insertAt)}
          onCancel={() => setDropped(null)}
        />
      )}
    </div>
  );
}
