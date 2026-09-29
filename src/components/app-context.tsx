"use client";

import { createContext, useContext, useMemo } from "react";
import type { CategoryRow, FxCode } from "@/lib/types";

export type LedgerInfo = {
  /** Görüntülenen defterin sahibi */
  ownerId: string;
  ownerName: string;
  /** Başkasının defterinde mi? */
  shared: boolean;
};

type AppData = {
  currency: string;
  timezone: string;
  today: string;
  username: string;
  isAdmin: boolean;
  categories: CategoryRow[];
  ledger: LedgerInfo;
  /** Erişilebilen tüm defterler (kendi + kabul edilen paylaşımlar) */
  ledgers: { ownerId: string; name: string; own: boolean }[];
  /** Bildirim aboneliği için genel VAPID anahtarı (yoksa bildirimler kapalı) */
  vapidPublicKey: string | null;
  /** Güncel döviz kurları (1 birim = ? TL); dövizle kayıt girerken önerilen kur. Çekilemediyse boş. */
  fxRates: Partial<Record<FxCode, number>>;
};

type AppContextValue = AppData & {
  categoryById: Map<string, CategoryRow>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ value, children }: { value: AppData; children: React.ReactNode }) {
  const ctx = useMemo<AppContextValue>(
    () => ({ ...value, categoryById: new Map(value.categories.map((c) => [c.id, c])) }),
    [value],
  );
  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp, AppProvider içinde kullanılmalı");
  return ctx;
}

export const UNCATEGORIZED = { name: "Kategorisiz", emoji: "·" } as const;
