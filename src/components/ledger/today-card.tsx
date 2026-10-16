"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shiftDate } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { todaySummary, type Payment } from "@/lib/payments";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { AppIcon } from "@/components/category-icon";
import { cn, Money, PendingAmount } from "@/components/ui";
import { PayButton } from "./pay-button";

const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "UTC" });
const weekdayShort = new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: "UTC" });
const monthName = new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" });

/** Kartta gezilebilen aralık: bugünden geriye / ileriye kaç gün */
const BACK = 7;
const AHEAD = 30;
const SWIPE_PX = 50;

const utc = (d: string) => new Date(`${d}T00:00:00Z`);
/** Cumartesi ya da Pazar */
const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/**
 * Ana ekranın en üstü: seçili günün ödemeleri (✓ ile ödenir) ve toplamı. Gün şeridinden ya da kartı
 * sağa/sola kaydırarak başka günlere bakılır (geçmiş 7, gelecek 30 gün). Gecikmişler her zaman altta.
 */
export function TodayCard({ payments }: { payments: Payment[] }) {
  const { currency, today, categoryById } = useApp();
  const [offset, setOffset] = useState(0);
  const date = shiftDate(today, offset);
  const s = todaySummary(payments, today);
  const items = payments.filter((p) => p.date === date);
  const total = items.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const d = utc(date);

  // Gün şeridi: her günün ödeme sayısı ve gecikmiş olup olmadığı
  const days = Array.from({ length: BACK + AHEAD + 1 }, (_, i) => {
    const day = shiftDate(today, i - BACK);
    const list = payments.filter((p) => p.date === day);
    return { day, off: i - BACK, count: list.length, overdue: list.some((p) => p.overdue) };
  });

  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Seçili gün şeridin görünür kısmında kalsın
    strip.current
      ?.querySelector<HTMLElement>(`[data-off="${offset}"]`)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [offset]);

  const go = (next: number) => {
    const clamped = Math.max(-BACK, Math.min(AHEAD, next));
    if (clamped === offset) return;
    haptic("select");
    setOffset(clamped);
  };

  // Kartı yatay kaydırarak gün değiştir (dikey kaydırmayı engellemez)
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    const t = e.changedTouches[0];
    touch.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) go(offset + (dx < 0 ? 1 : -1));
  };

  const label = offset === 0 ? "Bugün" : offset === 1 ? "Yarın" : offset === -1 ? "Dün" : weekday.format(d);

  return (
    <section aria-label="Günün ödemeleri" className="card rise overflow-hidden">
      {/* Gün şeridi */}
      <div
        ref={strip}
        className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-3 py-2"
        role="tablist"
        aria-label="Gün seç"
      >
        {days.map((x) => {
          const on = x.off === offset;
          const dd = utc(x.day);
          const weekend = isWeekend(dd);
          return (
            <button
              key={x.day}
              type="button"
              role="tab"
              aria-selected={on}
              data-off={x.off}
              onClick={() => go(x.off)}
              aria-label={`${x.day}${x.count ? `, ${x.count} ödeme` : ""}`}
              className={cn(
                "flex w-11 shrink-0 flex-col items-center rounded-xl py-1.5 transition-colors",
                on
                  ? "bg-ink text-bg"
                  : weekend
                    ? cn("bg-expense/[0.07] text-expense hover:bg-expense/[0.12]", x.off < 0 && "opacity-60")
                    : x.off < 0
                      ? "text-ink-3 hover:bg-surface-2"
                      : "text-ink-2 hover:bg-surface-2",
              )}
            >
              <span className="text-[10px] font-medium capitalize leading-none opacity-80">
                {x.off === 0 ? "bugün" : weekdayShort.format(dd).replace(".", "")}
              </span>
              <span className="num mt-1 text-base font-semibold leading-none">{dd.getUTCDate()}</span>
              <span
                className={cn(
                  "mt-1 size-1.5 rounded-full",
                  x.count === 0 ? "bg-transparent" : x.overdue ? "bg-expense" : on ? "bg-bg" : "bg-income-fill",
                )}
              />
            </button>
          );
        })}
      </div>

      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="touch-pan-y">
        <div className="flex items-center gap-4 p-4 sm:p-5">
          {/* Takvim yaprağı */}
          <div className="flex w-16 shrink-0 flex-col items-center overflow-hidden rounded-2xl border border-line bg-surface-2/60">
            <span
              className={cn(
                "w-full py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white",
                offset === 0 ? "bg-expense" : isWeekend(d) ? "bg-expense/70" : "bg-ink-3",
              )}
            >
              {monthName.format(d)}
            </span>
            <span className="num py-1 text-3xl font-semibold leading-none tracking-tight">{d.getUTCDate()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium capitalize text-ink-3">
              {label}
              {offset !== 0 && Math.abs(offset) > 1 ? "" : ` · ${weekday.format(d)}`} · {monthYear.format(d)}
            </p>
            {items.length > 0 ? (
              <>
                <p className="mt-0.5 text-sm text-ink-2">
                  {items.length} ödeme{offset < 0 && " · gecikmiş"}
                </p>
                <Money
                  minor={total}
                  currency={currency}
                  fracClassName="opacity-40"
                  className={cn(
                    "mt-0.5 block text-2xl font-semibold leading-tight tracking-tight",
                    offset < 0 && "text-expense",
                  )}
                />
              </>
            ) : (
              <p className="mt-1 text-[15px] font-medium leading-snug text-ink-2">
                {offset === 0
                  ? "Bugün ödemeniz bulunmamaktadır"
                  : offset < 0
                    ? "Bu güne ait açık ödemeniz bulunmamaktadır"
                    : "Bu gün ödemeniz bulunmamaktadır"}{" "}
                <span role="img" aria-label="para kesesi">
                  💰
                </span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 self-start">
            <button
              type="button"
              onClick={() => go(offset - 1)}
              disabled={offset <= -BACK}
              aria-label="Önceki gün"
              className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-surface-2 disabled:opacity-25"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              onClick={() => go(offset + 1)}
              disabled={offset >= AHEAD}
              aria-label="Sonraki gün"
              className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-surface-2 disabled:opacity-25"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        {items.length > 0 && (
          <ul className="border-t border-line px-2 py-1">
            {items.map((p) => {
              const cat = p.categoryId ? categoryById.get(p.categoryId) : undefined;
              const name = p.note || cat?.name || UNCATEGORIZED.name;
              return (
                <li key={p.key} className="flex items-center gap-3 px-2 py-1.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
                    <AppIcon name={cat?.emoji} size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                  {p.amount === null ? (
                    <PendingAmount />
                  ) : (
                    <Money minor={p.amount} currency={currency} className="shrink-0 whitespace-nowrap text-sm" />
                  )}
                  <PayButton
                    label={name}
                    target={
                      p.source === "once"
                        ? { type: "once", transactionId: p.id }
                        : { type: "recurring", recurringId: p.id, due: p.date }
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-xs">
        {offset !== 0 ? (
          <button type="button" onClick={() => go(0)} className="font-medium text-ink-2 hover:text-ink">
            ← Bugüne dön
          </button>
        ) : (
          <span className="text-ink-3">Kartı kaydır ya da günü seç</span>
        )}
        <Link href="/odemeler" className="flex items-center gap-0.5 text-ink-3 hover:text-ink">
          Tüm ödemeler <ChevronRight size={14} />
        </Link>
      </div>

      {s.overdue.length > 0 && (
        <Link
          href="/odemeler"
          className="flex items-center gap-3 border-t border-expense/25 bg-expense/[0.07] px-4 py-3 text-sm transition-colors hover:bg-expense/[0.12]"
        >
          <CircleAlert size={17} className="shrink-0 text-expense" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold text-expense">{s.overdue.length} gecikmiş ödeme</span>
            <span className="text-ink-2">
              {" · toplam "}
              <Money minor={s.overdueTotal} currency={currency} className="font-medium text-ink" />
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-expense" />
        </Link>
      )}
    </section>
  );
}
