import type { LevelInfo } from "./types";
import { RULES } from "./config";

// Every level takes the same amount of XP (RULES.xpPerLevel).
// 0-99 XP = Level 1, 100-199 = Level 2, ...
export function levelInfo(xp: number): LevelInfo {
  return {
    level: Math.floor(xp / RULES.xpPerLevel) + 1,
    xp_into_level: xp % RULES.xpPerLevel,
    xp_for_next: RULES.xpPerLevel,
  };
}
