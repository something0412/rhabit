import { CircleHelp, Pause, Trash2, TreePalm, Waves, type LucideIcon } from "lucide-react";

// Store cards name their icon in packages/shared/src/store.ts (e.g. icon: "tree-palm").
// This turns that name into the actual Lucide icon. Add a line here when you add a new card.
const ICONS: Record<string, LucideIcon> = {
  "tree-palm": TreePalm, // Day Off card
  waves: Waves, // Flexible Day card
  "trash-2": Trash2, // Delete card
  pause: Pause, // Pause Pack
};

export function CardIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? CircleHelp; // a "?" if the name is missing here
  return <Icon className={className} aria-hidden />;
}
