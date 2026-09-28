"use client";

import { createContext, useContext, useMemo } from "react";
import type { CategoryRow } from "@/lib/types";

type AppData = {
  currency: string;
  timezone: string;
  today: string;
  username: string;
  isAdmin: boolean;
  categories: CategoryRow[];
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
