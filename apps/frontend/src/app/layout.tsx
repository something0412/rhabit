import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Discipline Planner",
  description: "Plan your day, beat the timer, earn discipline points.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
