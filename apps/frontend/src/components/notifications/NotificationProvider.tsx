"use client";

import { createContext, useContext, useState } from "react";

export type NotificationKind = "info" | "warning" | "danger" | "success";

// Optional buttons inside a notification, e.g. "Start day" / "Take a day off"
export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  title: string;
  message?: string;
  actions?: NotificationAction[];
  time: Date;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  notify: (kind: NotificationKind, title: string, message?: string, actions?: NotificationAction[]) => void;
  dismiss: (id: number) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

let nextId = 1;

// Wrap the app in this so ANY component can call notify(...)
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  function notify(kind: NotificationKind, title: string, message?: string, actions?: NotificationAction[]) {
    const notification = { id: nextId++, kind, title, message, actions, time: new Date() };
    // newest goes at the END (= bottom of the stack); keep the last 30
    setNotifications((current) => [...current, notification].slice(-30));
  }

  function dismiss(id: number) {
    setNotifications((current) => current.filter((n) => n.id !== id));
  }

  function clearAll() {
    setNotifications([]);
  }

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

// Usage in a component:  const { notify } = useNotifications();
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside <NotificationProvider>");
  return context;
}
