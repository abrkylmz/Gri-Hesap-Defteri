"use client";

import { X } from "lucide-react";
import type { DayTotal } from "@/lib/ledger";
import { dayMonth, dayOf, weekdayName, weekdayShort } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn, Money } from "@/components/ui";

/**
 * Ayın barkodu: her gün bir çizgi. Çizgi boyu o günün giderini (karekök ölçekli, küçük
 * harcamalar da görünür kalsın diye), üstteki yeşil çentik gelir girişini gösterir.
 */
export function Barcode({
  daily,
  today,
  selected,
  onSelect,
  currency,
  compact = false,
}: {
  daily: DayTotal[];
  today: string;
  selected: string | null;
  onSelect: (date: string | null) => void;
  currency: string;
  /** Kompakt görünüm: daha alçak grafik */
  compact?: boolean;
}) {
  const max = Math.max(...daily.map((d) => d.expense), 1);
  const scale = (v: number) => Math.sqrt(v / max);
  const selectedDay = daily.find((d) => d.date === selected) ?? null;
  const busiest = daily.reduce<DayTotal | null>(
    (b, d) => (d.expense > 0 && (!b || d.expense > b.expense) ? d : b),
    null,
  );
  const labelDays = new Set([1, 8, 15, 22, daily.length]);

  return (
    <section className="card rise overflow-hidden p-5 [animation-delay:60ms]" aria-label="Günlük barkod">
      <div className="flex min-h-9 items-center justify-between gap-3">
        {selectedDay ? (
          <>
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                {dayMonth(selectedDay.date)} <span className="text-ink-3">{weekdayName(selectedDay.date)}</span>
              </p>
              <p className="mt-0.5 text-ink-2">
                Gider <Money minor={selectedDay.expense} currency={currency} className="text-ink" />
                {selectedDay.income > 0 && (
                  <>
                    {" · "}Gelir <Money minor={selectedDay.income} currency={currency} className="text-income" />
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2"
              aria-label="Gün seçimini temizle"
            >
              <X size={15} />
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow">Ayın barkodu</p>
            <p className="truncate text-xs text-ink-2">
              {busiest ? (
                <>
                  En yoğun gün · {dayMonth(busiest.date)} ·{" "}
                  <Money minor={busiest.expense} currency={currency} className="text-ink" />
                </>
              ) : (
                "Henüz harcama yok"
              )}
            </p>
          </>
        )}
      </div>

      <div
        className={cn("relative flex items-stretch gap-[2px] sm:gap-[3px]", compact ? "mt-3 h-20" : "mt-4 h-32")}
        role="group"
        aria-label="Günler"
      >
        {daily.map((d, i) => {
          const future = d.date > today;
          const isToday = d.date === today;
          const dim = selected !== null && selected !== d.date;
          const h = d.expense > 0 ? Math.max(scale(d.expense) * 100, 6) : 0;
          return (
            <button
              key={d.date}
              type="button"
              disabled={future && d.expense === 0 && d.income === 0}
              onClick={() => onSelect(selected === d.date ? null : d.date)}
              aria-pressed={selected === d.date}
              aria-label={`${dayMonth(d.date)} ${weekdayShort(d.date)}: gider ${formatMoney(d.expense, currency)}, gelir ${formatMoney(d.income, currency)}`}
              className={cn(
                "group relative flex flex-1 flex-col justify-end transition-opacity duration-300",
                dim && "opacity-25",
                "disabled:cursor-default",
              )}
            >
              {d.income > 0 && (
                <span className="absolute inset-x-0 top-0 h-1.5 rounded-[1px] bg-income-fill" />
              )}
              {h > 0 ? (
                <span
                  className={cn(
                    "bar-grow block w-full rounded-t-[2px]",
                    selected === d.date ? "bg-expense" : "bg-ink group-hover:bg-expense",
                  )}
                  style={{ height: `${h * 0.86}%`, animationDelay: `${i * 14}ms` }}
                />
              ) : (
                <span
                  className={cn(
                    "block h-[3px] w-full rounded-[1px]",
                    future ? "bg-line opacity-60" : "bg-ink-3 opacity-40",
                  )}
                />
              )}
              {isToday && (
                <span className="absolute -bottom-2.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-ink" />
              )}
            </button>
          );
        })}
      </div>

      <div className="num mt-4 flex gap-[2px] text-[10px] text-ink-3 sm:gap-[3px]" aria-hidden>
        {daily.map((d) => (
          <span key={d.date} className="flex-1 text-center">
            {labelDays.has(dayOf(d.date)) ? dayOf(d.date) : ""}
          </span>
        ))}
      </div>
    </section>
  );
}
