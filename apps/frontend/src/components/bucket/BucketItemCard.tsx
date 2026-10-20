"use client";

import { useState } from "react";
import type { BucketItem } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { clearDragData, setDragData } from "@/lib/dragData";
import { prettyDate, prettyTime } from "@/lib/dates";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { DetailsArrow, DetailsBox } from "@/components/common/Details";

interface Props {
  item: BucketItem;
  today: string; // "YYYY-MM-DD", to label scheduled tasks from earlier days
  onRemove: (item: BucketItem) => void;
  onDetailsSaved: (item: BucketItem, details: string) => void;
}

// One thing in the to-do bucket. You can pick it up and drag it somewhere.
export function BucketItemCard({ item, today, onRemove, onDetailsSaved }: Props) {
  const { notify } = useNotifications();
  const [showDetails, setShowDetails] = useState(false);
  const isScheduled = item.source === "scheduled";

  // A bucket item is really a note or a scheduled task, so save to the right place
  async function saveDetails(details: string) {
    try {
      if (item.source === "note") {
        await api.patch(`/notes/${item.id}`, { details });
      } else {
        await api.patch(`/schedule/${item.id}`, { details });
      }
      onDetailsSaved(item, details);
    } catch (error) {
      notify("danger", "Couldn't save details", errorMessage(error));
    }
  }

  return (
    <li
      draggable={!showDetails}
      onDragStart={(e) => setDragData(e, { kind: "bucket", source: item.source, id: item.id })}
      onDragEnd={clearDragData}
      className="cursor-grab rounded-lg border border-line bg-surface p-2.5 shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        <DetailsArrow open={showDetails} hasDetails={item.details !== ""} onToggle={() => setShowDetails(!showDetails)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="text-[11px] text-muted">
            {isScheduled ? "📅 Scheduled" : "📝 Note"}
            {item.time && ` · ${prettyTime(item.time)}`}
            {item.duration_minutes && ` · ${item.duration_minutes} min`}
            {item.date && item.date < today && ` · from ${prettyDate(item.date)}`}
          </p>
        </div>
        <button
          onClick={() => onRemove(item)}
          title={isScheduled ? "Ignore it" : "Put it back in Notes"}
          aria-label="Remove from bucket"
          className="rounded-md px-1.5 text-muted hover:bg-subtle hover:text-ink"
        >
          ×
        </button>
      </div>

      {showDetails && <DetailsBox value={item.details} onSave={saveDetails} />}
    </li>
  );
}
