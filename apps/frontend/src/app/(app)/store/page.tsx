"use client";

import { useEffect } from "react";
import type { StoreItem, StoreItemKind, StoreResponse } from "@productivity/shared";
import { STORE_ITEMS } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { usePlayer } from "@/components/player/PlayerProvider";

const sections: { kind: StoreItemKind; title: string; subtitle: string }[] = [
  { kind: "card", title: "Cards", subtitle: "Used up when you use them. You can hold as many as you like." },
  { kind: "theme", title: "Themes", subtitle: "Buy once, switch anytime." },
  { kind: "character", title: "Characters", subtitle: "Shown next to your name in the sidebar." },
];

export default function StorePage() {
  const { notify } = useNotifications();
  const { profile, status, setPlayer } = usePlayer();

  // Refresh coins and inventory when the Store opens
  useEffect(() => {
    async function loadStore() {
      try {
        const res = await api.get<StoreResponse>("/store");
        setPlayer(res.data.profile, res.data.status);
      } catch (error) {
        notify("danger", "Couldn't load the store", errorMessage(error));
      }
    }
    loadStore();
  }, []);

  async function buy(item: StoreItem) {
    try {
      const res = await api.post<StoreResponse>("/store/buy", { item_id: item.id });
      setPlayer(res.data.profile, res.data.status);
      notify("success", `Bought ${item.name}`, `-${item.price} coins`);
    } catch (error) {
      notify("danger", `Couldn't buy ${item.name}`, errorMessage(error));
    }
  }

  async function equip(item: StoreItem) {
    try {
      const res = await api.post<StoreResponse>("/store/equip", { item_id: item.id });
      setPlayer(res.data.profile, res.data.status);
      notify("success", `${item.name} equipped`);
    } catch (error) {
      notify("danger", `Couldn't equip ${item.name}`, errorMessage(error));
    }
  }

  if (!profile || !status) return <p className="p-6 text-sm text-muted">Loading...</p>;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Store</h1>
          <p className="text-sm text-muted">Spend the coins you earn by finishing your tasks.</p>
        </div>
        <span className="rounded-full bg-amber-500/10 px-4 py-1.5 text-sm font-semibold text-amber-600">
          🪙 {profile.coins} coins
        </span>
      </header>

      {sections.map((section) => (
        <section key={section.kind}>
          <h2 className="text-sm font-semibold">{section.title}</h2>
          <p className="text-xs text-muted">{section.subtitle}</p>

          <div className="mt-3 grid grid-cols-1 gap-3 @lg:grid-cols-2 @3xl:grid-cols-3">
            {STORE_ITEMS.filter((item) => item.kind === section.kind).map((item) => {
              const ownedCount = status.inventory[item.id] ?? 0;
              const owned = item.price === 0 || ownedCount > 0;
              const equipped = item.id === profile.active_theme || item.id === profile.active_character;
              const canAfford = profile.coins >= item.price;

              return (
                <div key={item.id} className="flex flex-col rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-start gap-3">
                    {item.kind === "theme" ? (
                      <span className="h-10 w-10 shrink-0 rounded-lg" style={{ background: item.icon }} />
                    ) : (
                      <span className="text-3xl" aria-hidden>
                        {item.icon}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="mt-0.5 text-xs text-muted">{item.description}</p>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                    <span className="text-sm font-medium text-amber-600">
                      {item.price === 0 ? "Free" : `🪙 ${item.price}`}
                    </span>

                    {item.kind === "card" && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">You have {ownedCount}</span>
                        <button
                          onClick={() => buy(item)}
                          disabled={!canAfford}
                          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
                        >
                          Buy
                        </button>
                      </div>
                    )}

                    {item.kind !== "card" &&
                      (equipped ? (
                        <span className="rounded-md bg-accent-soft px-3 py-1 text-xs font-medium text-accent-ink">Equipped</span>
                      ) : owned ? (
                        <button
                          onClick={() => equip(item)}
                          className="rounded-md border border-line px-3 py-1 text-xs font-medium hover:bg-subtle"
                        >
                          Equip
                        </button>
                      ) : (
                        <button
                          onClick={() => buy(item)}
                          disabled={!canAfford}
                          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
                        >
                          Buy
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
