import { Router } from "express";
import type { StoreResponse } from "@productivity/shared";
import { findStoreItem } from "@productivity/shared";
import { supabase } from "../supabase";
import { HttpError } from "../httpError";
import { addItem, getInventory } from "../lib/inventory";
import { getProfile, playerStatus } from "../lib/player";
import { spendCoins } from "../lib/rewards";

const router = Router();

async function storeResponse(userId: string): Promise<StoreResponse> {
  const profile = await getProfile(userId);
  return { profile, status: await playerStatus(profile) };
}

// GET /store  -> your coins and what you own (the item list itself is in the shared package)
router.get("/", async (req, res) => {
  res.json(await storeResponse(req.userId));
});

// POST /store/buy  { item_id }
router.post("/buy", async (req, res) => {
  const item = findStoreItem(String(req.body.item_id));
  if (!item) throw new HttpError(404, "That item doesn't exist");
  if (item.price === 0) throw new HttpError(400, "You already own this. It's free!");

  if (item.kind !== "card") {
    const owned = (await getInventory(req.userId))[item.id] ?? 0;
    if (owned > 0) throw new HttpError(400, "You already own this");
  }

  await spendCoins(req.userId, item.price, `Bought ${item.name}`);
  await addItem(req.userId, item.id);

  res.json(await storeResponse(req.userId));
});

// POST /store/equip  { item_id }   (themes and characters you own)
router.post("/equip", async (req, res) => {
  const item = findStoreItem(String(req.body.item_id));
  if (!item || item.kind === "card") throw new HttpError(400, "Only themes and characters can be equipped");

  const owned = item.price === 0 || ((await getInventory(req.userId))[item.id] ?? 0) > 0;
  if (!owned) throw new HttpError(400, "Buy it first");

  const column = item.kind === "theme" ? "active_theme" : "active_character";
  const { error } = await supabase.from("profiles").update({ [column]: item.id }).eq("id", req.userId);
  if (error) throw error;

  res.json(await storeResponse(req.userId));
});

export default router;
