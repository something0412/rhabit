import type { Inventory } from "@productivity/shared";
import { supabase } from "../supabase";
import { HttpError } from "../httpError";

// { day_off_card: 2, theme_ocean: 1, ... }
export async function getInventory(userId: string): Promise<Inventory> {
  const { data, error } = await supabase.from("inventory").select("item_id, quantity").eq("user_id", userId);
  if (error) throw error;

  const inventory: Inventory = {};
  for (const row of data) inventory[row.item_id] = row.quantity;
  return inventory;
}

export async function addItem(userId: string, itemId: string, amount = 1) {
  const { data: row, error } = await supabase
    .from("inventory")
    .select("quantity")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .maybeSingle();
  if (error) throw error;

  if (row) {
    const { error: updateError } = await supabase
      .from("inventory")
      .update({ quantity: row.quantity + amount })
      .eq("user_id", userId)
      .eq("item_id", itemId);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from("inventory")
      .insert({ user_id: userId, item_id: itemId, quantity: amount });
    if (insertError) throw insertError;
  }
}

// Uses up one card. Throws a friendly error if you don't have any.
export async function useItem(userId: string, itemId: string, missingMessage: string) {
  const inventory = await getInventory(userId);
  const owned = inventory[itemId] ?? 0;
  if (owned <= 0) throw new HttpError(400, missingMessage);

  const { error } = await supabase
    .from("inventory")
    .update({ quantity: owned - 1 })
    .eq("user_id", userId)
    .eq("item_id", itemId);
  if (error) throw error;
}
