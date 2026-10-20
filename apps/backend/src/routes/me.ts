import { Router } from "express";
import type { ProfileResponse } from "@productivity/shared";
import { supabase } from "../supabase";
import { HttpError } from "../httpError";
import { getProfile, grantMonthlyDayOff, playerStatus } from "../lib/player";
import { emergencyStopsLeft } from "../lib/days";

const router = Router();

// GET /me  -> profile, level, inventory, rewards history
router.get("/", async (req, res) => {
  const gift = await grantMonthlyDayOff(await getProfile(req.userId));
  const profile = await getProfile(req.userId);

  const { data: rewardEvents, error } = await supabase
    .from("reward_events")
    .select("id, xp, coins, reason, created_at")
    .eq("user_id", req.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const { count: daysOffTaken, error: countError } = await supabase
    .from("day_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", req.userId)
    .eq("status", "day_off");
  if (countError) throw countError;

  const body: ProfileResponse = {
    profile,
    status: await playerStatus(profile),
    reward_events: rewardEvents,
    reward_changes: gift ? [gift] : [],
    emergency_stops_left: await emergencyStopsLeft(req.userId),
    days_off_taken: daysOffTaken ?? 0,
  };
  res.json(body);
});

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/; // "09:00" ... "23:59"

// PATCH /me  { display_name?, timezone?, work_start?, work_end?, work_days? }
router.patch("/", async (req, res) => {
  const profile = await getProfile(req.userId);
  const { display_name, timezone, work_start, work_end, work_days } = req.body;
  const changes: Record<string, unknown> = {};

  if (display_name !== undefined) {
    const name = String(display_name).trim();
    if (name.length < 1 || name.length > 40) throw new HttpError(400, "Name must be 1-40 characters");
    changes.display_name = name;
  }

  if (timezone !== undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }); // throws if the timezone is invalid
    } catch {
      throw new HttpError(400, "Invalid timezone");
    }
    changes.timezone = timezone;
  }

  if (work_start !== undefined || work_end !== undefined) {
    const start = work_start ?? profile.work_start;
    const end = work_end ?? profile.work_end;
    if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) throw new HttpError(400, "Times must look like 09:00");
    if (start >= end) throw new HttpError(400, "Work hours must end after they start");
    changes.work_start = start;
    changes.work_end = end;
  }

  if (work_days !== undefined) {
    const valid =
      Array.isArray(work_days) && work_days.every((d: unknown) => Number.isInteger(d) && Number(d) >= 0 && Number(d) <= 6);
    if (!valid) throw new HttpError(400, "Work days must be numbers from 0 (Sunday) to 6 (Saturday)");
    changes.work_days = [...new Set(work_days as number[])].sort();
  }

  const { data, error } = await supabase.from("profiles").update(changes).eq("id", profile.id).select().single();
  if (error) throw error;
  res.json(data);
});

export default router;
