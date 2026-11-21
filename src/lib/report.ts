import { addMonths, dateInMonth, daysInMonth, monthOf } from "@/lib/dates";
import { summarize } from "@/lib/ledger";
import type { RecurringRow, TransactionRow } from "@/lib/types";

type MonthTotal = { month: string; income: number; expense: number };

// Aylık rapor (PDF) için ayrıntılı çözümleme. Saf fonksiyonlar: veri sayfada çekilir, burada hesaplanır.

export type Change = { cur: number; prev: number; diff: number; pct: number | null };
const change = (cur: number, prev: number): Change => ({
  cur,
  prev,
  diff: cur - prev,
  pct: prev > 0 ? (cur - prev) / prev : null,
});

/** Pazartesiden pazara (0 = Pazartesi) */
const weekdayIndex = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
export const WEEKDAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

/** Sabit giderler: düzenli ödeme, kredi taksiti ya da şablondan gelenler */
export const isFixed = (t: TransactionRow) => t.recurring_id !== null || t.loan_id !== null || t.template_id !== null;

export type CategoryRow = {
  key: string;
  categoryId: string | null;
  total: number;
  count: number;
  prev: number;
  share: number;
  /** Aylık bütçe (yoksa null) */
  budget: number | null;
};

export function analyzeMonth(input: {
  month: string;
  today: string;
  current: TransactionRow[];
  previous: TransactionRow[];
  trend: MonthTotal[];
  budgets: ReadonlyMap<string, number | null>;
}) {
  const { month, today, current, previous, trend, budgets } = input;
  const s = summarize(current, month);
  const p = summarize(previous, addMonths(month, -1));
  const prevByKey = new Map(p.categories.expense.map((c) => [c.key, c.total]));

  const categories: CategoryRow[] = s.categories.expense.map((c) => ({
    key: c.key,
    categoryId: c.categoryId,
    total: c.total,
    count: c.count,
    prev: prevByKey.get(c.key) ?? 0,
    share: s.expense > 0 ? c.total / s.expense : 0,
    budget: c.categoryId ? (budgets.get(c.categoryId) ?? null) : null,
  }));
  // Geçen ay olup bu ay hiç harcanmayan kategoriler de (sıfırla) görünsün.
  for (const c of p.categories.expense) {
    if (!categories.some((x) => x.key === c.key)) {
      categories.push({
        key: c.key,
        categoryId: c.categoryId,
        total: 0,
        count: 0,
        prev: c.total,
        share: 0,
        budget: c.categoryId ? (budgets.get(c.categoryId) ?? null) : null,
      });
    }
  }

  // Günler: içinde bulunulan ayda yalnızca bugüne kadarki günler sayılır.
  const isCurrent = monthOf(today) === month;
  const isFuture = month > monthOf(today);
  const dayCount = isFuture ? 0 : isCurrent ? Number(today.slice(8, 10)) : daysInMonth(month);
  const days = s.daily.slice(0, dayCount);
  const spent = current.filter((t) => t.kind === "expense" && t.amount !== null);
  const maxDay = days.reduce<{ date: string; amount: number } | null>(
    (m, d) => (d.expense > (m?.amount ?? 0) ? { date: d.date, amount: d.expense } : m),
    null,
  );
  const noSpendDays = days.filter((d) => d.expense === 0).length;

  const weekdays = WEEKDAYS.map(() => 0);
  for (const t of spent) weekdays[weekdayIndex(t.occurred_on)]! += t.amount!;

  const fixed = spent.filter(isFixed).reduce((sum, t) => sum + t.amount!, 0);
  const top = [...spent].sort((a, b) => b.amount! - a.amount!).slice(0, 5);

  const budgeted = categories.filter((c) => c.budget);
  const budget = budgeted.length
    ? {
        total: budgeted.reduce((sum, c) => sum + c.budget!, 0),
        spent: budgeted.reduce((sum, c) => sum + c.total, 0),
        over: budgeted.filter((c) => c.total > c.budget!).length,
        count: budgeted.length,
      }
    : null;

  const past = trend.filter((t) => t.month < month && (t.income > 0 || t.expense > 0));
  const avg = (f: (t: MonthTotal) => number) =>
    past.length ? past.reduce((sum, t) => sum + f(t), 0) / past.length : null;

  return {
    summary: s,
    income: change(s.income, p.income),
    expense: change(s.expense, p.expense),
    net: change(s.net, p.net),
    categories,
    daily: {
      days,
      count: spent.length,
      average: dayCount > 0 ? Math.round(s.expense / dayCount) : 0,
      maxDay,
      noSpendDays,
      dayCount,
    },
    weekdays,
    fixed,
    variable: s.expense - fixed,
    top,
    budget,
    average: { income: avg((t) => t.income), expense: avg((t) => t.expense), months: past.length },
  };
}

export type MonthAnalysis = ReturnType<typeof analyzeMonth>;

/** Gelecek ay beklenen ödemeler: deftere yazılmış ödenmemiş giderler + henüz yazılmamış düzenli ödemeler. */
export function expectedNextMonth(nextMonth: string, nextTransactions: TransactionRow[], recurring: RecurringRow[]) {
  const items: {
    date: string;
    note: string | null;
    categoryId: string | null;
    amount: number | null;
    fixed: boolean;
  }[] = nextTransactions
    .filter((t) => t.kind === "expense" && !t.paid)
    .map((t) => ({
      date: t.occurred_on,
      note: t.note,
      categoryId: t.category_id,
      amount: t.amount,
      fixed: isFixed(t),
    }));
  const written = new Set(nextTransactions.map((t) => t.recurring_id).filter(Boolean));
  for (const r of recurring) {
    if (!r.active || r.kind !== "expense" || written.has(r.id)) continue;
    const date = dateInMonth(nextMonth, r.day_of_month);
    if (r.starts_on > date) continue;
    items.push({ date, note: r.note, categoryId: r.category_id, amount: r.amount, fixed: true });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  return { items, total: items.reduce((sum, i) => sum + (i.amount ?? 0), 0) };
}

export type ItemGroup = { categoryId: string | null; total: number; items: TransactionRow[] };

/** Madde madde liste: kayıtlar kategoriye göre gruplanır (büyükten küçüğe), her grupta tarih sırası. */
export function itemize(transactions: TransactionRow[], kind: "income" | "expense") {
  const groups = new Map<string, ItemGroup>();
  for (const t of transactions) {
    if (t.kind !== kind) continue;
    const key = t.category_id ?? "";
    const g = groups.get(key) ?? { categoryId: t.category_id, total: 0, items: [] };
    g.total += t.amount ?? 0;
    g.items.push(t);
    groups.set(key, g);
  }
  const list = [...groups.values()].sort((a, b) => b.total - a.total);
  for (const g of list)
    g.items.sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || (b.amount ?? 0) - (a.amount ?? 0));
  return {
    groups: list,
    total: list.reduce((s, g) => s + g.total, 0),
    count: list.reduce((s, g) => s + g.items.length, 0),
  };
}

export type YearCategory = {
  key: string;
  categoryId: string | null;
  total: number;
  count: number;
  prev: number;
  share: number;
};

/**
 * Yıllık rapor çözümlemesi. `previous`: geçen yılın kategori/ay toplamları (getYearSummary'den).
 * İçinde bulunulan yılda yalnızca bugüne kadarki aylar ortalamaya girer.
 */
export function analyzeYear(input: {
  year: number;
  today: string;
  transactions: TransactionRow[];
  previous: {
    months: MonthTotal[];
    categories: { categoryId: string | null; kind: "income" | "expense"; total: number; count: number }[];
  };
}) {
  const { year, today, transactions, previous } = input;
  const counted = transactions.filter((t) => t.amount !== null);
  const months: MonthTotal[] = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    income: 0,
    expense: 0,
  }));
  for (const t of counted) months[Number(t.occurred_on.slice(5, 7)) - 1]![t.kind] += t.amount!;
  const income = months.reduce((s, m) => s + m.income, 0);
  const expense = months.reduce((s, m) => s + m.expense, 0);
  // Ortalama için geçen aylar: geçmiş yılda 12, bu yılda bugünkü aya kadar, gelecekte 0.
  const thisYear = Number(today.slice(0, 4));
  const elapsed = year < thisYear ? 12 : year > thisYear ? 0 : Number(today.slice(5, 7));
  // Süren yıl, geçen yılın aynı dönemiyle (Ocak–bu ay) karşılaştırılır.
  const samePeriod = elapsed < 12;
  const prevPeriod = previous.months.filter((m) => Number(m.month.slice(5, 7)) <= elapsed);
  const prevIncome = prevPeriod.reduce((s, m) => s + m.income, 0);
  const prevExpense = prevPeriod.reduce((s, m) => s + m.expense, 0);
  const active = months.filter((m) => m.income > 0 || m.expense > 0);
  const byNet = [...active].sort((a, b) => b.income - b.expense - (a.income - a.expense));
  const byExpense = [...active].filter((m) => m.expense > 0).sort((a, b) => b.expense - a.expense);

  const categoriesOf = (kind: "income" | "expense") => {
    const total = kind === "income" ? income : expense;
    const map = new Map<string, YearCategory>();
    for (const t of counted) {
      if (t.kind !== kind) continue;
      const key = t.category_id ?? "";
      const c = map.get(key) ?? { key, categoryId: t.category_id, total: 0, count: 0, prev: 0, share: 0 };
      c.total += t.amount!;
      c.count++;
      map.set(key, c);
    }
    for (const p of previous.categories) {
      if (p.kind !== kind) continue;
      const key = p.categoryId ?? "";
      const c = map.get(key) ?? { key, categoryId: p.categoryId, total: 0, count: 0, prev: 0, share: 0 };
      c.prev += p.total;
      map.set(key, c);
    }
    const list = [...map.values()];
    for (const c of list) c.share = total > 0 ? c.total / total : 0;
    return list.sort((a, b) => b.total - a.total || b.prev - a.prev);
  };

  const spent = counted.filter((t) => t.kind === "expense");
  const weekdays = WEEKDAYS.map(() => 0);
  for (const t of spent) weekdays[weekdayIndex(t.occurred_on)]! += t.amount!;
  const fixed = spent.filter(isFixed).reduce((s, t) => s + t.amount!, 0);

  return {
    months,
    income: change(income, prevIncome),
    expense: change(expense, prevExpense),
    net: change(income - expense, prevIncome - prevExpense),
    hasPrevious: prevIncome > 0 || prevExpense > 0,
    /** true: karşılaştırma geçen yılın aynı dönemiyle (kategoriler yine tüm yıl) */
    samePeriod,
    prevMonths: previous.months,
    elapsed,
    average: {
      income: elapsed > 0 ? Math.round(income / elapsed) : 0,
      expense: elapsed > 0 ? Math.round(expense / elapsed) : 0,
    },
    best: byNet[0] ?? null,
    worst: byNet.length > 1 ? byNet.at(-1)! : null,
    heaviest: byExpense[0] ?? null,
    lightest: byExpense.length > 1 ? byExpense.at(-1)! : null,
    expenseCategories: categoriesOf("expense"),
    incomeCategories: categoriesOf("income"),
    weekdays,
    fixed,
    variable: expense - fixed,
    top: [...spent].sort((a, b) => b.amount! - a.amount!).slice(0, 10),
    count: transactions.length,
    expenseCount: spent.length,
    pendingAmounts: transactions.filter((t) => t.amount === null).length,
  };
}

export type YearAnalysis = ReturnType<typeof analyzeYear>;
