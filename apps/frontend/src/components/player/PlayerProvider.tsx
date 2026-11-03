"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { PlayerStatus, Profile, ProfileResponse } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { rewardNotification } from "@/lib/rewards";
import { useNotifications } from "@/components/notifications/NotificationProvider";

interface PlayerContextValue {
  profile: Profile | null;
  status: PlayerStatus | null;
  // Call this with the profile + status from ANY API response, so the sidebar etc. update
  setPlayer: (profile: Profile, status: PlayerStatus) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

// Remember the theme in the browser, so the page doesn't flash the default theme on load
function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // storage blocked: fine, the theme still applies
  }
}

// Holds the player's profile (XP, coins, theme...) for the whole app.
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { notify } = useNotifications();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<PlayerStatus | null>(null);
  const previousLevel = useRef<number | null>(null);

  // Load the profile once when the app opens
  // (the saved theme is already applied by the script in app/layout.tsx)
  useEffect(() => {
    async function loadPlayer() {
      try {
        const res = await api.get<ProfileResponse>("/me");
        setPlayer(res.data.profile, res.data.status);
        for (const event of res.data.reward_changes) {
          const n = rewardNotification(event);
          notify(n.kind, n.title, n.message);
        }
      } catch (error) {
        notify("danger", "Couldn't load your profile", errorMessage(error));
      }
    }
    loadPlayer();
  }, []);

  function setPlayer(nextProfile: Profile, nextStatus: PlayerStatus) {
    const level = nextStatus.level.level;
    if (previousLevel.current !== null && level > previousLevel.current) {
      notify("success", `Level up! You're now Level ${level}`);
    }
    if (previousLevel.current !== null && level < previousLevel.current) {
      notify("danger", `Dropped to Level ${level}`, "Penalties took away some XP.");
    }
    previousLevel.current = level;

    setProfile(nextProfile);
    setStatus(nextStatus);
    applyTheme(nextProfile.active_theme);
  }

  return <PlayerContext.Provider value={{ profile, status, setPlayer }}>{children}</PlayerContext.Provider>;
}

// Usage in a component:  const { profile, status, setPlayer } = usePlayer();
export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return context;
}
