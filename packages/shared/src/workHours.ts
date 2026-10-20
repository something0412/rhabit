import type { Profile } from "./types";

// "09:30" -> 570 (minutes after midnight)
export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Automatic reminders are only allowed on work days, between work_start and work_end.
// (Uses the Date's local time, so call it in the browser, or with a date in the user's timezone.)
export function isWithinWorkHours(profile: Profile, date: Date = new Date()): boolean {
  if (!profile.work_days.includes(date.getDay())) return false;

  const now = date.getHours() * 60 + date.getMinutes();
  return now >= minutesOfDay(profile.work_start) && now < minutesOfDay(profile.work_end);
}
