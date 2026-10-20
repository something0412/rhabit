// All the reward/penalty numbers live here, so you can tune them in one place.
// Positive = you earn it. Negative = a penalty.

export const REWARDS = {
  completeTask: { xp: 10, coins: 5 },
  fullDayBonus: { xp: 30, coins: 15 },
  extendTimer: { xp: -5, coins: -5 },
  deleteTask: { xp: -10, coins: -10 },
  missTask: { xp: -15, coins: -15 },
  overPausePer10Min: { xp: -2, coins: -2 },
};

export const RULES = {
  minMinutesForRewards: 10, // tasks shorter than this earn nothing (anti-farming)
  dailyXpCap: 120, // max XP you can EARN in one day
  dailyCoinsCap: 60, // max coins you can EARN in one day
  xpPerLevel: 100,

  freePauseMinutesPerDay: 30,
  pauseCardMinutes: 30, // each Pause Pack card adds this much free pause time
  emergencyStopsPerWeek: 2,

  flexibleUnlockLevel: 5, // flexible mode unlocks at this level...
  badWeekMissedTasks: 3, // ...but locks while you have this many missed tasks in the last 7 days
  flexibleModePenalties: false, // open decision: does flexible mode ever take XP/coins?

  breakSuggestAfterMinutes: 180, // suggest a break after 3h of back-to-back tasks
  breakSuggestLengthMinutes: 30,
  taskWarningSeconds: 5 * 60, // "5 minutes left" alert
  deadlineWarningSeconds: [30 * 60, 5 * 60], // deadline alerts at 30 min and 5 min
  lateStartReminderMinutes: 60, // "still working today?" this long after work starts
};
