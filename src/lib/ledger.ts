// Defter ekranının saf hesaplamaları: UI'dan bağımsız, test edilebilir.

import type { EntryKind, RecurringRow, TransactionRow } from "@/lib/database.types";
import { dateInMonth, dayOf, daysInMonth, monthOf } from "@/lib/dates";

export type DayTotal = { date: string; income: number; expense: number };
export type CategoryTotal = {
  key: string;
  kind: EntryKind;
  categoryId: string | null;
  total: number;
  count: number;
};

export const categoryKey = (kind: EntryKind, categoryId: string | null) =>
  `${kind}:${categoryId ?? "none"}`;

export function summarize(transactions: TransactionRow[], month: string) {
  const daily: DayTotal[] = Array.from({ length: daysInMonth(month) }, (_, i) => ({
    date: dateInMonth(month, i + 1),
    income: 0,
    expense: 0,
  }));
  const totals = { income: 0, expense: 0 };
  const byKey = new Map<string, CategoryTotal>();

  for (const t of transactions) {
    totals[t.kind] += t.amount;
    const day = daily[dayOf(t.occurred_on) - 1];
    if (day && monthOf(t.occurred_on) === month) day[t.kind] += t.amount;

    const key = categoryKey(t.kind, t.category_id);
    const entry = byKey.get(key) ?? { key, kind: t.kind, categoryId: t.category_id, total: 0, count: 0 };
    entry.total += t.amount;
    entry.count += 1;
    byKey.set(key, entry);
  }

  const sorted = [...byKey.values()].sort((a, b) => b.total - a.total);
  return {
    income: totals.income,
    expense: totals.expense,
    net: totals.income - totals.expense,
    daily,
    categories: {
      expense: sorted.filter((c) => c.kind === "expense"),
      income: sorted.filter((c) => c.kind === "income"),
    },
  };
}

/** Bu ay içinde henüz vadesi gelmemiş düzenli kayıtlar. */
export function upcomingRecurring(recurring: RecurringRow[], today: string) {
  const month = monthOf(today);
  return recurring
    .filter((r) => r.active)
    .map((r) => ({ ...r, date: dateInMonth(month, r.day_of_month) }))
    .filter((r) => r.date > today && r.starts_on <= r.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type Pace = {
  dailyAverage: number;
  /** Yalnızca içinde bulunulan ay için: bu tempoyla ay sonu gider tahmini */
  projected: number | null;
  /** Önceki aya göre gider değişimi (oran); karşılaştırma yoksa null */
  changeVsPrev: number | null;
  busiest: DayTotal | null;
};

export function pace(
  month: string,
  today: string,
  expense: number,
  daily: DayTotal[],
  prevMonthExpense: number,
): Pace {
  const currentMonth = monthOf(today);
  const total = daysInMonth(month);
  const elapsed = month === currentMonth ? dayOf(today) : month < currentMonth ? total : 0;

  const dailyAverage = elapsed > 0 ? Math.round(expense / elapsed) : 0;
  const projected = month === currentMonth ? Math.round((expense / Math.max(elapsed, 1)) * total) : null;
  const comparable = projected ?? expense;
  const changeVsPrev =
    prevMonthExpense > 0 && elapsed > 0 ? (comparable - prevMonthExpense) / prevMonthExpense : null;

  const busiest = daily.reduce<DayTotal | null>(
    (best, d) => (d.expense > 0 && (!best || d.expense > best.expense) ? d : best),
    null,
  );
  return { dailyAverage, projected, changeVsPrev, busiest };
}

export function groupByDate(transactions: TransactionRow[]) {
  const groups: { date: string; items: TransactionRow[]; net: number }[] = [];
  for (const t of transactions) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== t.occurred_on) {
      g = { date: t.occurred_on, items: [], net: 0 };
      groups.push(g);
    }
    g.items.push(t);
    g.net += t.kind === "income" ? t.amount : -t.amount;
  }
  return groups;
}

/** Türkçe'ye duyarlı, aksan/büyük-küçük harf bağımsız arama normalizasyonu. */
export const normalize = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");
