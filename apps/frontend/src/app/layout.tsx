import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Discipline Planner",
  description: "Plan your day, beat the timer, earn discipline points.",
};

// Runs in the browser BEFORE the page is drawn, so there's no flash of the wrong look.
// It puts the saved theme, light/dark mode and sidebar state on <html>:
//  - mode: with nothing saved yet, it follows the device's own setting (phone in dark mode -> dark)
//  - sidebar: with nothing saved yet, it starts collapsed on narrow screens (under 1024px)
const applySavedLook = `(function () {
  try {
    var theme = localStorage.getItem("theme");
    if (theme) document.documentElement.dataset.theme = theme;
    var mode = localStorage.getItem("mode");
    if (!mode) mode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.mode = mode;
    var sidebar = localStorage.getItem("sidebar");
    if (!sidebar) sidebar = window.innerWidth < 1024 ? "collapsed" : "expanded";
    document.documentElement.dataset.sidebar = sidebar;
  } catch (e) {}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script above changes <html>'s attributes before React starts,
    // and that's on purpose, so React shouldn't complain that they don't match the server's HTML.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applySavedLook }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
