"use client";

import { ArrowDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn, Spinner } from "@/components/ui";

const TRIGGER_PX = 72; // bu kadar çekince bırakıldığında yenilenir
const MAX_PX = 110;

/**
 * Aşağı çekip yenileme (dokunmatik). Ana ekrana eklenmiş uygulamada tarayıcının kendi
 * yenilemesi olmadığı için gerekli. Sayfa en tepedeyken ve bir çekmece/takvim açık
 * değilken çalışır; yatay kaydırmalarla çakışmaz.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pull, setPull] = useState(0);
  const start = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const pullRef = useRef(0); // bırakma anındaki çekme miktarı (state güncelleyicisinde yan etki olmasın)

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1 || window.scrollY > 0 || document.querySelector("dialog[open]")) return;
      start.current = { x: t.clientX, y: t.clientY, active: false };
    };
    const onMove = (e: TouchEvent) => {
      const s = start.current;
      const t = e.touches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (!s.active) {
        // Yalnızca belirgin dikey, aşağı yönlü hareket; yatay kaydırmaları bırak.
        if (Math.abs(dx) > Math.abs(dy) || dy < 8) {
          if (Math.abs(dx) > 8 || dy < -8) start.current = null;
          return;
        }
        s.active = true;
      }
      // Direnç: çektikçe yavaşlar
      pullRef.current = Math.min(MAX_PX, dy * 0.5);
      setPull(pullRef.current);
    };
    const onEnd = () => {
      const s = start.current;
      start.current = null;
      if (!s?.active) return;
      if (pullRef.current >= TRIGGER_PX) {
        navigator.vibrate?.(10);
        startTransition(() => router.refresh());
      }
      pullRef.current = 0;
      setPull(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  const shown = pending ? 48 : pull;
  const ready = pull >= TRIGGER_PX;

  return (
    <>
      <div
        aria-hidden={!pending}
        role={pending ? "status" : undefined}
        aria-label={pending ? "Yenileniyor" : undefined}
        className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 flex justify-center"
        style={{
          transform: `translateY(${shown - 44}px)`,
          opacity: shown > 4 ? 1 : 0,
          transition: pull === 0 ? "transform 250ms, opacity 250ms" : "none",
        }}
      >
        <span className="grid size-10 place-items-center rounded-full border border-line bg-surface text-ink shadow-lg">
          {pending ? (
            <Spinner />
          ) : (
            <ArrowDown
              size={18}
              className={cn("transition-transform duration-200", ready && "rotate-180")}
              style={{ opacity: Math.min(1, pull / TRIGGER_PX) }}
            />
          )}
        </span>
      </div>
      <div
        style={{
          transform: shown ? `translateY(${shown * 0.6}px)` : undefined,
          transition: pull === 0 ? "transform 250ms" : "none",
        }}
      >
        {children}
      </div>
    </>
  );
}
