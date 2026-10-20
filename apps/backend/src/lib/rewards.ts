import type { RewardEvent } from "@productivity/shared";
import { RULES } from "@productivity/shared";
import { supabase } from "../supabase";
import { HttpError } from "../httpError";
import { getProfile } from "./player";

export interface RewardChange {
  xp: number;
  coins: number;
}

// The ONE function that changes XP and coins. It applies the rules:
//  - you can't EARN more than the daily caps
//  - XP and coins never go below 0
// It records what was ACTUALLY applied in the history (reward_events).
// A change of { xp: 0, coins: 0 } is saved as a note, e.g. "Used a Day Off card".
// Returns null if a real change ended up as nothing (e.g. already at 0, or the cap was hit).
export async function changeRewards(
  userId: string,
  change: RewardChange,
  reason: string,
  dayPlanId: number | null,
  taskId: number | null = null
): Promise<RewardEvent | null> {
  const profile = await getProfile(userId);
  let xp = change.xp;
  let coins = change.coins;

  // Daily caps: only count what was EARNED on this day
  if ((xp > 0 || coins > 0) && dayPlanId) {
    const { data: rows, error } = await supabase
      .from("reward_events")
      .select("xp, coins")
      .eq("day_plan_id", dayPlanId);
    if (error) throw error;

    const earnedXp = rows.reduce((sum, row) => sum + Math.max(0, row.xp), 0);
    const earnedCoins = rows.reduce((sum, row) => sum + Math.max(0, row.coins), 0);
    if (xp > 0) xp = Math.min(xp, Math.max(0, RULES.dailyXpCap - earnedXp));
    if (coins > 0) coins = Math.min(coins, Math.max(0, RULES.dailyCoinsCap - earnedCoins));
  }

  // Floor at 0: with 3 coins, a -15 penalty only takes 3
  if (xp < 0) xp = Math.max(xp, -profile.xp);
  if (coins < 0) coins = Math.max(coins, -profile.coins);

  const wasRealChange = change.xp !== 0 || change.coins !== 0;
  if (wasRealChange && xp === 0 && coins === 0) return null;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ xp: profile.xp + xp, coins: profile.coins + coins })
    .eq("id", userId);
  if (updateError) throw updateError;

  const { data: event, error: insertError } = await supabase
    .from("reward_events")
    .insert({ user_id: userId, xp, coins, reason, day_plan_id: dayPlanId, task_id: taskId })
    .select("id, xp, coins, reason, created_at")
    .single();
  if (insertError) throw insertError;

  return event;
}

// A history note that doesn't change XP or coins
export function addNote(userId: string, reason: string, dayPlanId: number | null = null, taskId: number | null = null) {
  return changeRewards(userId, { xp: 0, coins: 0 }, reason, dayPlanId, taskId);
}

// For the store: fails if you can't afford it
export async function spendCoins(userId: string, price: number, reason: string) {
  const profile = await getProfile(userId);
  if (profile.coins < price) {
    throw new HttpError(400, `Not enough coins. You need ${price - profile.coins} more.`);
  }
  return changeRewards(userId, { xp: 0, coins: -price }, reason, null);
}
