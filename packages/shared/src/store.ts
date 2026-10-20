// Everything you can buy with coins. Prices are in coins.
//  - "card": used up when you use it (you can own several)
//  - "theme" / "character": bought once, then you can switch to it anytime

export type StoreItemKind = "card" | "theme" | "character";

export interface StoreItem {
  id: string;
  kind: StoreItemKind;
  name: string;
  description: string;
  price: number; // 0 = free, owned by everyone
  icon: string; // emoji for cards/characters, a color for themes
}

export const STORE_ITEMS: StoreItem[] = [
  // ----- cards -----
  { id: "day_off_card", kind: "card", name: "Day Off card", description: "Take a whole day off. No penalties, no reminders.", price: 60, icon: "🏖️" },
  { id: "flexible_card", kind: "card", name: "Flexible Day card", description: "Use flexible mode for one day, even while it's locked.", price: 40, icon: "🌀" },
  { id: "delete_card", kind: "card", name: "Delete card", description: "Delete a task after the day starts without losing XP or coins.", price: 15, icon: "🗑️" },
  { id: "pause_card", kind: "card", name: "Pause Pack", description: "+30 min of free pause time. Used automatically when you go over.", price: 15, icon: "⏸️" },

  // ----- themes -----
  { id: "theme_classic", kind: "theme", name: "Classic", description: "Clean and bright.", price: 0, icon: "#4f46e5" },
  { id: "theme_ocean", kind: "theme", name: "Ocean", description: "Cool blues and teals.", price: 100, icon: "#0891b2" },
  { id: "theme_forest", kind: "theme", name: "Forest", description: "Calm greens.", price: 100, icon: "#15803d" },
  { id: "theme_sunset", kind: "theme", name: "Sunset", description: "Warm oranges and pinks.", price: 120, icon: "#ea580c" },
  { id: "theme_midnight", kind: "theme", name: "Midnight", description: "A dark theme for late nights.", price: 200, icon: "#818cf8" },

  // ----- characters -----
  { id: "char_sprout", kind: "character", name: "Sprout", description: "Every journey starts small.", price: 0, icon: "🌱" },
  { id: "char_cat", kind: "character", name: "Cat", description: "Naps only after the work is done.", price: 80, icon: "🐱" },
  { id: "char_fox", kind: "character", name: "Fox", description: "Quick and focused.", price: 80, icon: "🦊" },
  { id: "char_robot", kind: "character", name: "Robot", description: "Never misses a timer.", price: 120, icon: "🤖" },
  { id: "char_dragon", kind: "character", name: "Dragon", description: "For the truly disciplined.", price: 250, icon: "🐉" },
];

export const DEFAULT_THEME = "theme_classic";
export const DEFAULT_CHARACTER = "char_sprout";

export function findStoreItem(id: string): StoreItem | undefined {
  return STORE_ITEMS.find((item) => item.id === id);
}
