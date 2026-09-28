"use client";

import type { MonthTotal } from "@/lib/data";
import { monthLabel, monthShort } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/components/ui";

export function Trend({
  trend,
  month,
  currency,
  onNavigate,
}: {
  trend: MonthTotal[];
  month: string;
  currency: string;
  onNavigate: (month: string) => void;
}) {
  const max = Math.max(...trend.flatMap((t) => [t.income, t.expense]), 1);

  return (
    <section className="card rise p-5 [animation-delay:180ms]" aria-label="Son 6 ay">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl tracking-tight">Son altı ay</h2>
        <p className="flex items-center gap-3 text-[11px] text-ink-3">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-income-fill" /> gelir
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-expense" /> gider
          </span>
        </p>
      </div>

      <div className="mt-5 grid grid-cols-6 gap-2">
        {trend.map((t, i) => {
          const net = t.income - t.expense;
          const selected = t.month === month;
          return (
            <button
              key={t.month}
              type="button"
              onClick={() => onNavigate(t.month)}
              aria-current={selected ? "true" : undefined}
              aria-label={`${monthLabel(t.month)}: gelir ${formatMoney(t.income, currency)}, gider ${formatMoney(t.expense, currency)}`}
              className={cn(
                "group flex flex-col items-center rounded-xl pb-1 pt-2 transition-opacity",
                !selected && "opacity-45 hover:opacity-100",
              )}
            >
              <div className="flex h-24 w-full items-end justify-center gap-[3px]">
                <span
                  className="bar-grow w-2.5 rounded-t-[2px] bg-income-fill"
                  style={{ height: `${(t.income / max) * 100}%`, animationDelay: `${i * 40}ms` }}
                />
                <span
                  className="bar-grow w-2.5 rounded-t-[2px] bg-expense"
                  style={{ height: `${(t.expense / max) * 100}%`, animationDelay: `${i * 40 + 20}ms` }}
                />
              </div>
              <span className={cn("mt-2 text-xs capitalize", selected ? "font-semibold" : "text-ink-2")}>
                {monthShort(t.month)}
              </span>
              <span className={cn("num text-[10px]", net < 0 ? "text-expense" : "text-ink-3")}>
                {net === 0 ? "—" : formatMoney(net, currency, { compact: true, sign: true })}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
