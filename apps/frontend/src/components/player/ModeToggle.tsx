"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { MorphIcon, type IconNode } from "morphicons/react";
import { usePlayer } from "@/components/player/PlayerProvider";

type Mode = "light" | "dark";

// The sun and moon icons as data: a list of SVG shapes (copied from the Lucide icon set).
// MorphIcon animates one shape into the other when the icon changes.
const SUN: IconNode = [
  ["circle", { cx: 12, cy: 12, r: 4 }],
  ["path", { d: "M12 2v2" }],
  ["path", { d: "M12 20v2" }],
  ["path", { d: "m4.93 4.93 1.41 1.41" }],
  ["path", { d: "m17.66 17.66 1.41 1.41" }],
  ["path", { d: "M2 12h2" }],
  ["path", { d: "M20 12h2" }],
  ["path", { d: "m6.34 17.66-1.41 1.41" }],
  ["path", { d: "m19.07 4.93-1.41 1.41" }],
];
const MOON: IconNode = [["path", { d: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" }]];

// The sun/moon button at the bottom of the sidebar: switches light <-> dark.
// Saved in this browser only (each device can have its own setting).
// The colors themselves are in globals.css ([data-mode="dark"]).
export function ModeToggle() {
  const { profile } = usePlayer();
  // null = not known yet. The server can't see the saved mode, so we wait for the browser to tell us.
  // (Otherwise the icon would start as a sun and morph into a moon on every page load.)
  const [mode, setMode] = useState<Mode | null>(null);
  const latestTransition = useRef<ViewTransition | null>(null); // the most recent flip

  // The script in app/layout.tsx already picked the mode before the page was drawn: read it
  useEffect(() => {
    setMode(document.documentElement.dataset.mode === "dark" ? "dark" : "light");
  }, []);

  function switchMode() {
    // Read the mode from the page itself (not the `mode` state): with two quick clicks,
    // the second one must see the first one's result, or both would switch to the same mode.
    const next: Mode = document.documentElement.dataset.mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.dataset.mode = next;
    try {
      localStorage.setItem("mode", next);
    } catch {
      // storage blocked: it still switches, it just won't be remembered
    }
  }

  // Switch with the "flip" effect (the animation itself is in globals.css).
  // Older browsers without View Transitions, and people who turned off animations, just switch.
  async function toggle() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduceMotion) {
      switchMode();
      return;
    }

    const html = document.documentElement;
    html.dataset.switching = "flip"; // turns on the flip rules in globals.css
    // flushSync = make React update the page right now, so the browser's "after" picture has the new colors
    const transition = document.startViewTransition(() => flushSync(switchMode));
    latestTransition.current = transition;
    try {
      await transition.finished;
    } finally {
      // Clicked again quickly? Then a newer flip is running: leave the marker on for that one.
      if (latestTransition.current === transition) delete html.dataset.switching;
    }
  }

  // Midnight is a dark theme on its own, so the button does nothing there
  const isMidnight = profile?.active_theme === "theme_midnight";

  return (
    <button
      onClick={toggle}
      disabled={isMidnight}
      title={isMidnight ? "Midnight is always dark" : mode === "dark" ? "Dark mode" : "Light mode"}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-subtle hover:text-ink disabled:opacity-50 disabled:hover:bg-transparent collapsed:justify-center collapsed:px-0"
    >
      {mode === null ? (
        <span className="h-4 w-4" /> // empty space of the same size until the mode is known
      ) : (
        // reducedMotion="user": people who turned off animations in their device settings get an instant swap
        <MorphIcon icon={isMidnight || mode === "dark" ? MOON : SUN} size={16} strokeWidth={2} spring="snappy" reducedMotion="user" />
      )}
      <span className="collapsed:hidden">
        {mode === null ? "" : isMidnight ? "Dark (Midnight)" : mode === "dark" ? "Dark mode" : "Light mode"}
      </span>
    </button>
  );
}
