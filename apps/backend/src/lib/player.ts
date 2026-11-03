import type { PlayerStatus, Profile, RewardEvent } from "@productivity/shared";
import { RULES, levelInfo } from "@productivity/shared";
import { supabase } from "../supabase";
import { addDays, todayIn } from "./dates";
import { addItem, getInventory } from "./inventory";

// Gets the user's profile, creating it the first time we see this user.
export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: userId })
    .select()
    .single();
  if (insertError) throw insertError;
  return created;
}

// How many tasks were missed in the last 7 days (including today)
export async function missedThisWeek(userId: string, today: string): Promise<number> {
  const { data: days, error } = await supabase
    .from("day_plans")
    .select("id")
    .eq("user_id", userId)
    .gte("date", addDays(today, -6));
  if (error) throw error;
  if (days.length === 0) return 0;

  const { count, error: countError } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .in(
      "day_plan_id",
      days.map((d) => d.id)
    )
    .eq("status", "missed");
  if (countError) throw countError;
  return count ?? 0;
}

// Free emergency stops left: the weekly allowance minus the ones used in the last 7 days
export async function emergencyStopsLeft(userId: string): Promise<number> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("pause_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "emergency")
    .gte("started_at", oneWeekAgo);
  if (error) throw error;
  return Math.max(0, RULES.emergencyStopsPerWeek - (count ?? 0));
}

// Level, flexible-mode status, inventory and emergency stops: things we CALCULATE, not store.
export async function playerStatus(profile: Profile): Promise<PlayerStatus> {
  const level = levelInfo(profile.xp);
  const missed = await missedThisWeek(profile.id, todayIn(profile.timezone));
  const badWeek = missed >= RULES.badWeekMissedTasks;

  return {
    level,
    flexible: {
      unlocked: level.level >= RULES.flexibleUnlockLevel && !badWeek,
      level_needed: RULES.flexibleUnlockLevel,
      missed_this_week: missed,
      bad_week: badWeek,
    },
    inventory: await getInventory(profile.id),
    emergency_stops_left: await emergencyStopsLeft(profile.id),
  };
}

// Everyone gets 1 free Day Off card per month.
// Returns a note for the rewards history if a card was given right now.
export async function grantMonthlyDayOff(profile: Profile): Promise<RewardEvent | null> {
  const month = todayIn(profile.timezone).slice(0, 7); // "2026-10"
  if (profile.free_day_off_month === month) return null;

  await addItem(profile.id, "day_off_card");

  const { error } = await supabase.from("profiles").update({ free_day_off_month: month }).eq("id", profile.id);
  if (error) throw error;

  const { data: event, error: insertError } = await supabase
    .from("reward_events")
    .insert({ user_id: profile.id, xp: 0, coins: 0, reason: "Free monthly Day Off card" })
    .select("id, xp, coins, reason, created_at")
    .single();
  if (insertError) throw insertError;
  return event;
}
