"use client";

import Link from "next/link";
import { ChevronRight, Clock, LineChart } from "lucide-react";
import { dayMonth } from "@/lib/dates";
import { useApp } from "@/components/app-context";
import { cn, Money } from "@/components/ui";

/** Varlıklar'a yansıyan fon özeti (yönetici). Ayrıntı ve değer girişi Fon getirisi sayfasında. */
export type FundsSummary = {
  value: number;
  daily: number | null;
  dailyPct: number | null;
  /** En son değer girilen gün (değer yoksa null) */
  lastDay: string | null;
  count: number;
};

const pctFmt = new Intl.NumberFormat("tr-TR", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});
/** Bu kadar günden eski değer "eski" sayılır ve uyarı gösterilir. */
const STALE_DAYS = 2;

export function FundsCard({ summary }: { summary: FundsSummary }) {
  const { currency, today } = useApp();
  const age = summary.lastDay
    ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${summary.lastDay}T00:00:00Z`)) / 86_400_000)
    : null;
  const stale = age !== null && age >= STALE_DAYS;
  const up = (summary.daily ?? 0) >= 0;

  return (
    <Link
      href="/fonlar"
      aria-label="Fonlar: ayrıntılar"
      className="card rise block p-4 transition-colors hover:bg-surface-2/60 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
          <span className="grid size-7 place-items-center rounded-lg bg-sky-500/12 text-sky-700 dark:text-sky-300">
            <LineChart size={15} />
          </span>
          Fonlar
          <span className="text-xs text-ink-3">· {summary.count} fon</span>
        </p>
        <ChevronRight size={16} className="text-ink-3" />
      </div>
      <Money
        minor={summary.value}
        currency={currency}
        fracClassName="opacity-40"
        className="mt-2 block text-[1.6rem] font-semibold leading-none tracking-tight"
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {summary.daily !== null && (
          <span className={up ? "text-income" : "text-expense"}>
            Bir önceki güne göre <Money minor={summary.daily} currency={currency} sign />
            {summary.dailyPct !== null && ` (${pctFmt.format(summary.dailyPct)})`}
          </span>
        )}
        {summary.lastDay && (
          <span
            className={cn(
              "flex items-center gap-1",
              stale
                ? "rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300"
                : "text-ink-3",
            )}
          >
            {stale && <Clock size={12} />}
            {age === 0
              ? "bugünkü değer"
              : age === 1
                ? "dünkü değer"
                : `${age} gün önceki değer (${dayMonth(summary.lastDay)})`}
          </span>
        )}
      </div>
      {stale && <p className="mt-2 text-[11px] text-ink-3">Toplam bu değerle hesaplanıyor; güncellemek için dokun.</p>}
    </Link>
  );
}
