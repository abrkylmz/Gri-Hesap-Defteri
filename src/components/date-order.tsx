"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { useEffect, useState } from "react";
import { haptic } from "@/lib/haptics";

/** Listelerde tarih sırası: "desc" = yeniden eskiye (ya da uzaktan yakına), "asc" = eskiden yeniye. */
export type DateOrder = "asc" | "desc";

const storageKey = (list: string) => `gri:sira:${list}`;

/**
 * Bir listenin tarih sırası. Seçim cihazda (localStorage) liste başına hatırlanır;
 * ilk çizimde varsayılan kullanılır, böylece sunucu/istemci çıktısı aynı kalır.
 */
export function useDateOrder(list: string, fallback: DateOrder) {
  const [order, setOrder] = useState<DateOrder>(fallback);
  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey(list));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage yalnızca istemcide okunabilir
      if (v === "asc" || v === "desc") setOrder(v);
    } catch {
      /* gizli sekme vb. */
    }
  }, [list]);
  const change = (next: DateOrder) => {
    setOrder(next);
    try {
      if (next === fallback) localStorage.removeItem(storageKey(list));
      else localStorage.setItem(storageKey(list), next);
    } catch {
      /* gizli sekme vb. */
    }
  };
  return [order, change] as const;
}

/** Diziyi istenen sıraya çevirir; `natural` dizinin şu anki sırasıdır. */
export const inOrder = <T,>(items: T[], natural: DateOrder, order: DateOrder) =>
  natural === order ? items : [...items].reverse();

/** Sıralama çipi: dokununca yön değişir. */
export function DateOrderToggle({
  order,
  onChange,
  labels = { desc: "Yeniden eskiye", asc: "Eskiden yeniye" },
  className = "chip shrink-0",
  iconOnlyOnMobile = false,
}: {
  order: DateOrder;
  onChange: (o: DateOrder) => void;
  labels?: Record<DateOrder, string>;
  className?: string;
  /** Telefonda yalnızca simge (dar başlık satırları için) */
  iconOnlyOnMobile?: boolean;
}) {
  const Icon = order === "desc" ? ArrowDownWideNarrow : ArrowUpNarrowWide;
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        haptic("select");
        onChange(order === "desc" ? "asc" : "desc");
      }}
      aria-label={`Sıralama: ${labels[order]}. Değiştirmek için dokun.`}
      title="Tarih sırasını değiştir"
    >
      <Icon size={iconOnlyOnMobile ? 16 : 14} />{" "}
      <span className={iconOnlyOnMobile ? "hidden sm:inline" : undefined}>{labels[order]}</span>
    </button>
  );
}
