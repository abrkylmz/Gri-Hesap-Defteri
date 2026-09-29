"use client";

import { useRef, useState } from "react";
import { haptic } from "@/lib/haptics";

const THRESHOLD_PX = 70;
const START_PX = 12;

/**
 * Yatay kaydırma hareketi (dokunmatik): sola → onNext, sağa → onPrev.
 * Dikey kaydırmaya karışmaz (yön belirleninceye kadar bekler); sürükleme sırasında
 * geri bildirim için ofset döndürür. Kayıt satırlarındaki kaydırmadan ayrı bir alanda kullanılır.
 */
export function useSwipe(onNext: () => void, onPrev: () => void) {
  const start = useRef<{ x: number; y: number; decided: "x" | "y" | null } | null>(null);
  const [dx, setDx] = useState(0);

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1) return;
      // Kendi yatay kaydırması olan öğelerde (şeritler, çipler) devreye girme.
      if ((e.target as HTMLElement).closest("[data-no-swipe], .overflow-x-auto")) return;
      start.current = { x: t.clientX, y: t.clientY, decided: null };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const s = start.current;
      const t = e.touches[0];
      if (!s || !t) return;
      const mx = t.clientX - s.x;
      const my = t.clientY - s.y;
      if (!s.decided) {
        if (Math.abs(mx) < START_PX && Math.abs(my) < START_PX) return;
        s.decided = Math.abs(mx) > Math.abs(my) * 1.3 ? "x" : "y";
      }
      if (s.decided === "x") setDx(mx * 0.35); // dirençli geri bildirim
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      const t = e.changedTouches[0];
      setDx(0);
      if (!s || s.decided !== "x" || !t) return;
      const mx = t.clientX - s.x;
      if (mx <= -THRESHOLD_PX) {
        haptic("select");
        onNext();
      } else if (mx >= THRESHOLD_PX) {
        haptic("select");
        onPrev();
      }
    },
  };

  return { dx, handlers };
}
