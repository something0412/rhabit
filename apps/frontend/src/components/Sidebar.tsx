"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight, House, LogOut, NotebookPen, ShoppingBag, UserRound } from "lucide-react";
import { findStoreItem } from "@productivity/shared";
import { usePlayer } from "@/components/player/PlayerProvider";
import { ModeToggle } from "@/components/player/ModeToggle";

const tabs = [
  { href: "/main", label: "Main", Icon: House },
  { href: "/notes", label: "Notes", Icon: NotebookPen },
  { href: "/scheduler", label: "Scheduler", Icon: CalendarDays },
  { href: "/store", label: "Store", Icon: ShoppingBag },
  { href: "/profile", label: "Profile", Icon: UserRound },
];

// The left column: your character, level, coins, and the app's tabs (layout based on a reUI sidebar).
//  - The < > button collapses it to a thin strip of icons, to give the page more room.
//    The choice is saved in this browser. Collapsed/expanded lives on <html data-sidebar="...">,
//    set before the page is drawn (app/layout.tsx), and "collapsed:" classes hide/shrink things.
//  - The highlight behind the current tab slides to the new tab when you switch (motion's layoutId).
export function Sidebar() {
  const pathname = usePathname();
  const { profile, status } = usePlayer();
  const character = profile ? findStoreItem(profile.active_character) : undefined;
  const [collapsed, setCollapsed] = useState(false);

  // The script in app/layout.tsx already decided: read it
  useEffect(() => {
    setCollapsed(document.documentElement.dataset.sidebar === "collapsed");
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.dataset.sidebar = next ? "collapsed" : "expanded";
    try {
      localStorage.setItem("sidebar", next ? "collapsed" : "expanded");
    } catch {
      // storage blocked: it still works, it just won't be remembered
    }
  }

  return (
    <nav className="flex h-screen w-56 shrink-0 flex-col border-r border-line bg-surface shadow-sm transition-[width] duration-300 ease-out collapsed:w-16">
      {/* ----- header: app name + collapse button ----- */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4 collapsed:justify-center collapsed:px-0">
        <div className="min-w-0 collapsed:hidden">
          <p className="truncate text-base font-semibold">Discipline Planner</p>
          <p className="text-xs text-muted">Demo mode</p>
        </div>
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-lg border border-line p-1.5 text-muted hover:bg-subtle hover:text-ink"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-4 collapsed:px-2">
        {/* ----- your character, level and coins ----- */}
        {profile && status && (
          <div
            title={`Level ${status.level.level} · ${profile.coins} coins`}
            className="mb-5 rounded-xl bg-subtle p-3 collapsed:flex collapsed:justify-center collapsed:bg-transparent collapsed:p-0"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl collapsed:text-2xl" aria-hidden>
                {character?.icon}
              </span>
              <div className="min-w-0 collapsed:hidden">
                <p className="truncate text-sm font-medium">{profile.display_name}</p>
                <p className="text-xs text-muted">Level {status.level.level}</p>
              </div>
            </div>
            <div className="collapsed:hidden">
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
                <span className="font-medium text-amber-600 dark:text-amber-400">🪙 {profile.coins}</span>
              </div>
            </div>
          </div>
        )}

        {/* ----- the tabs ----- */}
        <p className="mb-2 px-3 text-[11px] font-bold tracking-widest text-muted uppercase collapsed:hidden">Menu</p>
        <ul className="flex flex-col gap-0.5">
          {tabs.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={label}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-transform active:scale-[0.98] collapsed:justify-center collapsed:px-0 ${
                    active ? "font-semibold text-accent-ink" : "text-muted hover:bg-subtle hover:text-ink"
                  }`}
                >
                  {/* The highlight. layoutId = motion moves this same box from the old tab to the new one. */}
                  {active && (
                    <motion.span
                      layoutId="sidebar-active-tab"
                      className="absolute inset-0 rounded-lg border border-accent/25 bg-accent-soft"
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  <Icon className="relative h-4 w-4 shrink-0" aria-hidden />
                  <span className="relative collapsed:hidden">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ----- footer: light/dark + exit ----- */}
      <div className="shrink-0 border-t border-line p-3 collapsed:px-2">
        <ModeToggle />
        <Link
          href="/"
          title="Exit demo"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-subtle hover:text-ink collapsed:justify-center collapsed:px-0"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          <span className="collapsed:hidden">Exit demo</span>
        </Link>
      </div>
    </nav>
  );
}
