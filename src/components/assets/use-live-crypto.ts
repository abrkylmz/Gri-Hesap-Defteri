"use client";

import { useEffect, useMemo, useState } from "react";
import type { CryptoPrice } from "@/lib/crypto";

/** Sayfa açık ve görünürken kripto fiyatlarının yenilenme aralığı */
const POLL_MS = 30_000;

/**
 * Sunucudan gelen fiyatları, sayfa açıkken 30 sn'de bir /api/kripto'dan tazeler ("anlık").
 * Sekme arka plandayken sormaz; öne gelince hemen sorar. Her sembol için daha yeni olan fiyat kullanılır.
 */
export function useLiveCryptoPrices(symbols: string[], initial: Record<string, CryptoPrice>) {
  const [live, setLive] = useState<Record<string, CryptoPrice>>({});
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const key = [...new Set(symbols)].sort().join(",");

  useEffect(() => {
    if (!key) return;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/kripto?s=${encodeURIComponent(key)}`, { cache: "no-store" });
        if (!res.ok) return;
        const { prices } = (await res.json()) as { prices: Record<string, CryptoPrice> };
        if (stopped) return;
        setLive((old) => ({ ...old, ...prices }));
        setCheckedAt(Date.now());
      } catch {
        /* bağlantı yoksa sonraki turda tekrar dener */
      }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key]);

  const prices = useMemo(() => {
    const out: Record<string, CryptoPrice> = { ...initial };
    for (const [s, p] of Object.entries(live)) if (!out[s] || p.updatedMs >= out[s].updatedMs) out[s] = p;
    return out;
  }, [initial, live]);

  return { prices, checkedAt };
}
