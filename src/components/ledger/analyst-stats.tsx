"use client";

import { CalendarClock, ChartPie, Flame, Receipt, Scale, Sigma, type LucideIcon } from "lucide-react";
import { dayOf, daysInMonth, monthOf } from "@/lib/dates";
import type { TransactionRow } from "@/lib/types";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { cn, Money } from "@/components/ui";

const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });

/**
 * "Analist" görünümündeki istatistik paneli: ayın giderlerinden türetilen göstergeler.
 * (İşlem sayısı, ortalama, en büyük gider, en çok harcanan kategori, gider/gelir, günlük bütçe.)
 */
export function AnalystStats({
  transactions,
  month,
  today,
  income,
  expense,
  topCategory,
}: {
  transactions: TransactionRow[];
  month: string;
  today: string;
  income: number;
  expense: number;
  /** Ayın en çok harcanan kategorisi (özetten) */
  topCategory: { categoryId: string | null; total: number } | null;
}) {
  const { currency, categoryById } = useApp();
  const expenses = transactions.filter((t) => t.kind === "expense" && t.amount !== null);
  const count = expenses.length;
  const average = count ? Math.round(expense / count) : 0;
  const biggest = expenses.reduce<TransactionRow | null>((m, t) => (!m || t.amount! > m.amount! ? t : m), null);
  const topName = topCategory
    ? (topCategory.categoryId && categoryById.get(topCategory.categoryId)?.name) || UNCATEGORIZED.name
    : null;
  const ratio = income > 0 ? expense / income : null;
  // Bu ay için: kalan günlere düşen harcanabilir tutar (gelir − gider) / kalan gün
  const isCurrent = monthOf(today) === month;
  const daysLeft = isCurrent ? daysInMonth(month) - dayOf(today) + 1 : 0;
  const left = income - expense;
  const dailyBudget = isCurrent && daysLeft > 0 && left > 0 ? Math.floor(left / daysLeft) : null;

  return (
    <section aria-label="Analiz" className="rise grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Stat icon={Receipt} label="Gider işlemi">
        <span className="num">{count}</span>
      </Stat>
      <Stat icon={Sigma} label="Ortalama gider">
        <Money minor={average} currency={currency} />
      </Stat>
      <Stat
        icon={Flame}
        label="En büyük gider"
        sub={biggest ? biggest.note || (biggest.category_id && categoryById.get(biggest.category_id)?.name) || "—" : undefined}
      >
        {biggest ? <Money minor={biggest.amount!} currency={currency} /> : "—"}
      </Stat>
      <Stat
        icon={ChartPie}
        label="En çok harcanan"
        sub={topCategory && expense > 0 ? `giderin ${pct.format(topCategory.total / expense)}` : undefined}
      >
        <span className="truncate">{topName ?? "—"}</span>
      </Stat>
      <Stat icon={Scale} label="Gider / gelir" tone={ratio !== null && ratio > 1 ? "bad" : undefined}>
        <span className="num">{ratio === null ? "—" : pct.format(ratio)}</span>
      </Stat>
      <Stat
        icon={CalendarClock}
        label="Günlük harcanabilir"
        sub={isCurrent ? `${daysLeft} gün kaldı` : "geçmiş ay"}
        tone={isCurrent && dailyBudget === null && expense > 0 ? "bad" : undefined}
      >
        {dailyBudget !== null ? <Money minor={dailyBudget} currency={currency} /> : "—"}
      </Stat>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  sub,
  tone,
  children,
}: {
  icon: LucideIcon;
  label: string;
  sub?: string;
  tone?: "bad";
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
        <Icon size={14} strokeWidth={1.9} className="shrink-0" /> {label}
      </p>
      <p className={cn("mt-1.5 truncate text-base font-semibold", tone === "bad" && "text-expense")}>{children}</p>
      {sub && <p className="truncate text-[11px] text-ink-3">{sub}</p>}
    </div>
  );
}
