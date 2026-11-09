// These types match the database columns exactly (snake_case),
// so data from Supabase can be sent to the frontend without converting it.

export type DayMode = "timer" | "deadline" | "flexible";
export type DayStatus = "planning" | "active" | "done" | "failed" | "excused" | "day_off";
export type TaskStatus = "planned" | "running" | "completed" | "missed" | "deleted";
export type PauseType = "pause" | "emergency";

export interface Profile {
  id: string;
  display_name: string;
  timezone: string;
  xp: number; // experience: decides your level
  coins: number; // money: spent in the store
  work_start: string; // "09:00"
  work_end: string; // "17:00"
  work_days: number[]; // 0 = Sunday ... 6 = Saturday
  active_theme: string; // store item id, e.g. "theme_ocean"
  active_character: string; // store item id, e.g. "char_fox"
  free_day_off_month: string | null; // "2026-10" = this month's free Day Off card was given
}

export interface DayPlan {
  id: number;
  user_id: string;
  date: string; // "YYYY-MM-DD"
  mode: DayMode;
  deadline_at: string | null; // only used in deadline mode
  status: DayStatus;
  started_at: string | null;
  paused_at: string | null; // set while the day is paused
  pause_type: PauseType | null;
  total_paused_seconds: number; // all pauses + emergency stops
  regular_paused_seconds: number; // only normal pauses (counts against the free allowance)
  bonus_pause_seconds: number; // extra free pause time from Pause Pack cards
  flexible_card_used: boolean; // a Flexible Day card was used to start this day (refunded on restart)
  emergency_paid: boolean; // the current emergency stop was paid for (no free ones left this week)
  deadline_extra_seconds: number; // deadline mode: how much later emergency stops moved the deadline (rounded up)
  work_seconds: number; // flexible mode: counted-up working time so far (while tasks were left to do)
  work_running_since: string | null; // flexible mode: the count-up timer is running since then (null = stopped)
}

export interface Task {
  id: number;
  day_plan_id: number;
  title: string;
  details: string; // the dropdown note, e.g. "whites only"
  duration_minutes: number | null; // null = no time set (allowed in deadline and flexible mode)
  is_break: boolean;
  position: number;
  status: TaskStatus;
  started_at: string | null; // when this task's timer started (timer mode)
  paused_seconds: number; // how long this task spent paused
  completed_at: string | null;
  created_at: string; // when the task was added (flexible mode: the 10-minute rule)
  bucket_done: boolean; // a MISSED task was taken out of the bucket ("From previous days"): re-added or ignored
  redo_task_id: number | null; // a missed task that was re-added: the new task it became
}

// One row in the rewards history: +10 XP +5 coins, -15 XP -15 coins, etc.
export interface RewardEvent {
  id: number;
  xp: number;
  coins: number;
  reason: string;
  created_at: string;
}

// item id -> how many you own, e.g. { day_off_card: 2, theme_ocean: 1 }
export type Inventory = Record<string, number>;

export interface LevelInfo {
  level: number;
  xp_into_level: number; // XP earned inside the current level
  xp_for_next: number; // XP needed to finish the current level
}

export interface FlexibleStatus {
  unlocked: boolean; // can use flexible mode without a card
  level_needed: number;
  missed_this_week: number;
  bad_week: boolean;
}

// Things calculated from the profile (not stored as columns)
export interface PlayerStatus {
  level: LevelInfo;
  flexible: FlexibleStatus;
  inventory: Inventory;
  emergency_stops_left: number; // free emergency stops left in the last 7 days
}

// A to-do on the Notes tab: no timer, no deadline, no rewards
export interface Note {
  id: number;
  user_id: string;
  title: string;
  details: string;
  done: boolean;
  in_bucket: boolean; // dragged into the to-do bucket
  added_to_date: string | null; // "2026-10-20" = assigned: moved into that day's plan
  task_id: number | null; // the task it became (if that task is deleted, the note comes back)
  task_status: TaskStatus | null; // that task's status right now (filled in by the API, not a column)
  created_at: string;
}

export type ScheduledStatus = "scheduled" | "added" | "dismissed";

// A task planned for a future date on the Scheduler tab.
// On that date it shows up in the bucket.
export interface ScheduledTask {
  id: number;
  user_id: string;
  title: string;
  details: string;
  date: string; // "YYYY-MM-DD"
  time: string | null; // "14:30", or null for "any time"
  duration_minutes: number | null;
  status: ScheduledStatus;
  task_id: number | null; // the task it became when added to a plan
  created_at: string;
}

// Something in the to-do bucket: either a note or a scheduled task that's due
export type BucketSource = "note" | "scheduled" | "missed"; // missed = a task missed on a previous day

export interface BucketItem {
  source: BucketSource;
  id: number;
  title: string;
  details: string;
  duration_minutes: number | null;
  date: string | null; // scheduled tasks only
  time: string | null; // scheduled tasks only
}

// ---- API response shapes ----

// POST /bucket/add-to-day: the updated day AND the updated bucket
export interface AddFromBucketResponse {
  day: DayResponse;
  bucket: BucketItem[];
}

// Every /days and /tasks endpoint replies with the full, updated day.
export interface DayResponse {
  day: DayPlan;
  tasks: Task[];
  profile: Profile;
  status: PlayerStatus;
  reward_changes: RewardEvent[]; // rewards/penalties caused by this request
}

export interface ProfileResponse {
  profile: Profile;
  status: PlayerStatus;
  reward_events: RewardEvent[]; // history, newest first
  reward_changes: RewardEvent[]; // e.g. the free monthly Day Off card, just given
  days_off_taken: number;
}

export interface StoreResponse {
  profile: Profile;
  status: PlayerStatus;
}
