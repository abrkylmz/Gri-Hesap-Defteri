"use client";

import { monthLabel, monthOf } from "@/lib/dates";
import { goalProgress, monthlyNeeded, type Goal } from "@/lib/goals";
import { useApp } from "@/components/app-context";
import { AppIcon } from "@/components/category-icon";
import { cn, Money } from "@/components/ui";

const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });

/** Tek hedefin özeti: ikon, ad, ilerleme çubuğu, biriken / hedef ve aylık gereken. */
export function GoalSummary({ goal, compact = false }: { goal: Goal; compact?: boolean }) {
  const { currency, today } = useApp();
  const p = goalProgress(goal);
  const done = goal.saved >= goal.target;
  const perMonth = monthlyNeeded(goal, today);
  const late = goal.due !== null && goal.due < today && !done;

  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-2xl",
          compact ? "size-10" : "size-12",
          done ? "bg-income-fill/25 text-income" : "bg-sky-500/12 text-sky-700 dark:text-sky-300",
        )}
      >
        <AppIcon name={goal.icon} size={compact ? 18 : 21} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold">{goal.name}</span>
          <span className={cn("num shrink-0 text-xs font-semibold", done ? "text-income" : "text-ink-2")}>
            {pct.format(p)}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-ink-3">
          <Money minor={goal.saved} currency={currency} fracClassName="opacity-40" className="text-ink-2" /> /{" "}
          <Money minor={goal.target} currency={currency} fracClassName="opacity-40" />
        </span>
        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-2">
          <span
            className={cn("block h-full rounded-full transition-[width] duration-700", done ? "bg-income-fill" : "bg-sky-500")}
            style={{ width: `${p * 100}%` }}
          />
        </span>
        {!compact && (
          <span className="mt-1.5 block text-xs text-ink-3">
            {done ? (
              <span className="font-medium text-income">Tamamlandı ✓</span>
            ) : late ? (
              <span className="text-expense">Hedef tarih geçti</span>
            ) : perMonth !== null ? (
              <>
                <span className="capitalize">{monthLabel(monthOf(goal.due!))}</span>’e kadar · ayda{" "}
                <Money minor={perMonth} currency={currency} fracClassName="opacity-40" className="font-semibold text-ink" />{" "}
                biriktir
              </>
            ) : (
              "Hedef tarih yok"
            )}
          </span>
        )}
      </span>
    </div>
  );
}
