import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import { NotificationStack } from "@/components/notifications/NotificationStack";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { WorkReminders } from "@/components/player/WorkReminders";
import { Sidebar } from "@/components/Sidebar";

// Layout for every page inside the app (Main, Store, Profile):
//   [ left sidebar ] [ page content ] [ notification stack ]
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <PlayerProvider>
        <WorkReminders />
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="@container flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]">{children}</main>
          <NotificationStack />
        </div>
      </PlayerProvider>
    </NotificationProvider>
  );
}
