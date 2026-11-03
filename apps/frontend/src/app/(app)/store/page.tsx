"use client";

import { useEffect, useState } from "react";
import { CardIcon } from "@/components/common/CardIcon";
import { SearchBar } from "@/components/common/SearchBar";
import type { StoreItem, StoreItemKind, StoreResponse } from "@productivity/shared";
import { STORE_ITEMS } from "@productivity/shared";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errorMessage";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { usePlayer } from "@/components/player/PlayerProvider";
import { HoloButton } from "@/components/common/HoloButton";

const sections: { kind: StoreItemKind; title: string; subtitle: string }[] = [
  { kind: "card", title: "Cards", subtitle: "Used up when you use them. You can hold as many as you like." },
  { kind: "theme", title: "Themes", subtitle: "Buy once, switch anytime." },
  { kind: "character", title: "Characters", subtitle: "Shown next to your name in the sidebar." },
];

export default function StorePage() {
  const { notify } = useNotifications();
  const { profile, status, setPlayer } = usePlayer();
  const [search, setSearch] = useState("");

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

  // Search: keep items whose name or description contains the typed text (any upper/lower case)
  const query = search.trim().toLowerCase();
  const shownItems = STORE_ITEMS.filter(
    (item) => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Store</h1>
          <p className="text-sm text-muted">Spend the coins you earn by finishing your tasks.</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Search the store..." expandedWidth="14rem" />
          <span className="rounded-full bg-amber-500/10 px-4 py-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
            🪙 {profile.coins} coins
          </span>
        </div>
      </header>

      {shownItems.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          Nothing in the store matches &quot;{search.trim()}&quot;.
        </p>
      )}

      {/* a section with no matching items is hidden */}
      {sections
        .filter((section) => shownItems.some((item) => item.kind === section.kind))
        .map((section) => (
          <section key={section.kind}>
            <h2 className="text-sm font-semibold">{section.title}</h2>
            <p className="text-xs text-muted">{section.subtitle}</p>

            <div className="mt-3 grid grid-cols-1 gap-3 @lg:grid-cols-2 @3xl:grid-cols-3">
              {shownItems.filter((item) => item.kind === section.kind).map((item) => {
                const ownedCount = status.inventory[item.id] ?? 0;
                const owned = item.price === 0 || ownedCount > 0;
                const equipped = item.id === profile.active_theme || item.id === profile.active_character;
                const canAfford = profile.coins >= item.price;

                return (
                  <div key={item.id} className="flex flex-col rounded-xl border border-line bg-surface p-4">
                    <div className="flex items-start gap-3">
                      {item.kind === "theme" ? (
                        <span className="h-10 w-10 shrink-0 rounded-lg" style={{ background: item.icon }} />
                      ) : item.kind === "card" ? (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                          <CardIcon name={item.icon} className="h-5 w-5" />
                        </span>
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
                      <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        {item.price === 0 ? "Free" : `🪙 ${item.price}`}
                      </span>

                      {item.kind === "card" && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted">You have {ownedCount}</span>
                          <HoloButton
                            onClick={() => buy(item)}
                            disabled={!canAfford}
                            size="sm"
                          >
                            Buy
                          </HoloButton>
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
                          <HoloButton
                            onClick={() => buy(item)}
                            disabled={!canAfford}
                            size="sm"
                          >
                            Buy
                          </HoloButton>
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
