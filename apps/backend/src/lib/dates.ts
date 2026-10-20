export function nowIso(): string {
  return new Date().toISOString();
}

// Today's date ("YYYY-MM-DD") in the user's own timezone
export function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// addDays("2026-10-20", 1) -> "2026-10-21",  addDays("2026-10-20", -6) -> "2026-10-14"
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
