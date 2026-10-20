"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { findStoreItem } from "@productivity/shared";
import { usePlayer } from "@/components/player/PlayerProvider";

const tabs = [
  { href: "/main", label: "Main", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/notes", label: "Notes", icon: "M6 3h9l4 4v14H6V3zm3 8h7M9 15h7" },
  { href: "/scheduler", label: "Scheduler", icon: "M4 6h16v15H4V6zm0 5h16M8 3v5m8-5v5" },
  { href: "/store", label: "Store", icon: "M4 7h16l-1.5 12h-13L4 7zm4 0V5a4 4 0 018 0v2" },
  { href: "/profile", label: "Profile", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0" },
];

// The left column: your character, level, coins, and the app's tabs.
export function Sidebar() {
  const pathname = usePathname();
  const { profile, status } = usePlayer();
  const character = profile ? findStoreItem(profile.active_character) : undefined;

  return (
    <nav className="flex h-screen w-56 shrink-0 flex-col border-r border-line bg-surface">
      <div className="px-5 pt-5 pb-3">
        <p className="text-base font-semibold">Discipline Planner</p>
        <p className="text-xs text-muted">Demo mode</p>
      </div>

      {profile && status && (
        <div className="mx-3 mb-3 rounded-xl bg-subtle p-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {character?.icon}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{profile.display_name}</p>
              <p className="text-xs text-muted">Level {status.level.level}</p>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-accent"
              style={{ width: `${(status.level.xp_into_level / status.level.xp_for_next) * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted">
            <span>
              {status.level.xp_into_level}/{status.level.xp_for_next} XP
            </span>
            <span className="font-medium text-amber-600">🪙 {profile.coins}</span>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-1 px-3">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-accent-soft font-medium text-accent-ink" : "text-muted hover:bg-subtle"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d={tab.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto p-3">
        <Link href="/" className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-subtle">
          Exit demo
        </Link>
      </div>
    </nav>
  );
}
