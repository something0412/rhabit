"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { HoloButton } from "@/components/common/HoloButton";

// Landing page. No real login yet, just a button to enter as the demo user.
export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function enterDemo() {
    setLoading(true);
    setError("");
    try {
      // Tell the backend our timezone, so "today" and "end of day" are correct
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await api.patch("/me", { timezone });
      router.push("/main");
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-sm border border-line">
        <h1 className="text-2xl font-semibold">Discipline Planner</h1>
        <p className="mt-2 text-muted">
          Plan your day, run a timer for every task, and earn discipline points for finishing what you planned.
        </p>

        <HoloButton
          onClick={enterDemo}
          disabled={loading}
          className="mt-6 w-full"
        >
          {loading ? "Entering..." : "Enter demo"}
        </HoloButton>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <p className="mt-4 text-xs text-muted">Real sign-up and login will come later.</p>
      </div>
    </main>
  );
}
