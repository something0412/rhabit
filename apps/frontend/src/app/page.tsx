"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";

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

        <button
          onClick={enterDemo}
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Entering..." : "Enter demo"}
        </button>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <p className="mt-4 text-xs text-muted">Real sign-up and login will come later.</p>
      </div>
    </main>
  );
}
