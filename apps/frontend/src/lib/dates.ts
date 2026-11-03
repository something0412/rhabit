// Today's date as "YYYY-MM-DD" in the browser's local time
export function localDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "2026-10-20" -> "Tue, Oct 20"
export function prettyDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// "14:30" + 60 minutes -> "2:30 PM – 3:30 PM"   (no minutes: just "2:30 PM")
export function prettyTimeRange(time: string, minutes: number | null): string {
  if (!minutes) return prettyTime(time);
  const [h, m] = time.split(":").map(Number);
  const end = new Date(2000, 0, 1, h, m + minutes);
  const endText = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${prettyTime(time)} – ${endText}`;
}

// "14:30" -> "2:30 PM"
export function prettyTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
