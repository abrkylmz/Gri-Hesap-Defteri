"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Son gösterilen değerler (anahtara göre). Bileşen sayfa geçişinde yeniden oluşsa da, örneğin ay
 * değişince, sayı eski değerden yenisine sayarak geçer. Yalnızca tarayıcıda dolar; ilk yüklemede
 * boş olduğundan sunucu çıktısıyla uyuşmazlık olmaz.
 */
const last = new Map<string, number>();
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Değer değişince eski değerden yenisine kısa bir animasyonla sayar (tam sayı, ör. kuruş).
 * "Hareketi azalt" açıksa doğrudan yeni değeri gösterir.
 */
export function useCountUp(target: number, key?: string, duration = 700): number {
  const [value, setValue] = useState(() =>
    typeof window !== "undefined" && key !== undefined ? (last.get(key) ?? target) : target,
  );
  const current = useRef(value);

  useEffect(() => {
    if (key !== undefined) last.set(key, target);
    const from = current.current;
    if (from === target) return;
    const ms = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = ms === 0 ? 1 : Math.min(1, (now - start) / ms);
      const v = t === 1 ? target : Math.round(from + (target - from) * easeOut(t));
      current.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, key, duration]);

  return value;
}
