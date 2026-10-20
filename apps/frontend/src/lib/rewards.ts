import type { RewardEvent } from "@productivity/shared";
import type { NotificationKind } from "@/components/notifications/NotificationProvider";

// "+10 XP · +5 coins", "-15 XP · -15 coins", or "" for notes like "Used a Day Off card"
export function formatReward(event: Pick<RewardEvent, "xp" | "coins">): string {
  const parts: string[] = [];
  if (event.xp !== 0) parts.push(`${event.xp > 0 ? "+" : ""}${event.xp} XP`);
  if (event.coins !== 0) parts.push(`${event.coins > 0 ? "+" : ""}${event.coins} coins`);
  return parts.join(" · ");
}

// What a reward event looks like as a notification
export function rewardNotification(event: RewardEvent): { kind: NotificationKind; title: string; message?: string } {
  const amount = formatReward(event);
  if (!amount) return { kind: "info", title: event.reason }; // a note, nothing gained or lost
  const gained = event.xp > 0 || event.coins > 0;
  return { kind: gained ? "success" : "danger", title: amount, message: event.reason };
}
