// Yaklaşan (ve gecikmiş) ödemeler: defterdeki ödenmemiş faturalar + düzenli ödemelerin sonraki tarihleri.

import { addMonths, dateInMonth, monthOf, shiftDate } from "@/lib/dates";
import type { RecurringRow, TransactionRow } from "@/lib/types";

export type Payment = {
  key: string;
  /** "once": defterdeki kayıt (✓ ile ödenir) · "recurring": henüz yazılmamış düzenli ödeme */
  source: "once" | "recurring";
  id: string;
  date: string;
  note: string | null;
  categoryId: string | null;
  /** Kuruş; tutarı henüz belli olmayan (şablondan boş gelen) kayıtta null */
  amount: number | null;
  overdue: boolean;
  /** Nereden geldiği: kredi taksiti, şablon, düzenli, hatırlatmalı ya da ileri tarihli gider */
  origin: "loan" | "template" | "recurring" | "reminder" | "planned";
};

export const HORIZON_DAYS = 60;
/** Geriye dönük en fazla bu kadar gün "gecikmiş" gösterilir */
export const OVERDUE_DAYS = 45;

const originOf = (t: TransactionRow): Payment["origin"] =>
  t.loan_id ? "loan" : t.template_id ? "template" : t.recurring_id ? "recurring" : t.remind_days !== null ? "reminder" : "planned";

/** Açıkça ödenmesi gereken kayıt mı? (Sıradan, bugüne kadarki harcamalar "gecikmiş" sayılmasın.) */
const isDueItem = (t: TransactionRow) => t.loan_id !== null || t.template_id !== null || t.remind_days !== null;

/**
 * @param transactions Ödenmemiş giderler (yaklaşık bugün−45 … bugün+60 aralığı)
 * @param doneRuns     Erken ödenmiş düzenli dönemler: "id|YYYY-MM"
 */
export function upcomingPayments(
  transactions: TransactionRow[],
  recurring: RecurringRow[],
  today: string,
  doneRuns: ReadonlySet<string> = new Set(),
  horizonDays = HORIZON_DAYS,
): Payment[] {
  const end = shiftDate(today, horizonDays);
  const start = shiftDate(today, -OVERDUE_DAYS);
  const out: Payment[] = [];

  for (const t of transactions) {
    if (t.kind !== "expense" || t.paid || t.occurred_on > end || t.occurred_on < start) continue;
    const overdue = t.occurred_on < today;
    // Geçmiş tarihli olanlardan yalnız açık ödemeler (kredi, şablon, hatırlatmalı); bugünküler için bunlar ve
    // bugün yazılan düzenli ödeme; ileri tarihli her gider planlı ödemedir. (Bugünkü kahve ödeme sayılmaz.)
    const include = overdue ? isDueItem(t) : t.occurred_on === today ? isDueItem(t) || t.recurring_id !== null : true;
    if (!include) continue;
    out.push({
      key: `t:${t.id}`,
      source: "once",
      id: t.id,
      date: t.occurred_on,
      note: t.note,
      categoryId: t.category_id,
      amount: t.amount,
      overdue,
      origin: originOf(t),
    });
  }

  // Düzenli ödemelerin henüz deftere yazılmamış (bugünden sonraki) tarihleri
  for (const r of recurring) {
    if (!r.active || r.kind !== "expense") continue;
    for (let m = monthOf(today); ; m = addMonths(m, 1)) {
      const date = dateInMonth(m, r.day_of_month);
      if (date > end) break;
      if (date <= today || date < r.starts_on || doneRuns.has(`${r.id}|${m}`)) continue;
      out.push({
        key: `r:${r.id}:${m}`,
        source: "recurring",
        id: r.id,
        date,
        note: r.note,
        categoryId: r.category_id,
        amount: r.amount,
        overdue: false,
        origin: "recurring",
      });
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || (b.amount ?? 0) - (a.amount ?? 0));
}

export type PaymentGroup = { key: "overdue" | "today" | "week" | "month" | "later"; label: string; items: Payment[] };

/** Gecikmiş · Bugün · Bu hafta (7 gün) · Bu ay · Sonra */
export function groupPayments(items: Payment[], today: string): PaymentGroup[] {
  const week = shiftDate(today, 7);
  const month = monthOf(today);
  const groups: PaymentGroup[] = [
    { key: "overdue", label: "Gecikmiş", items: [] },
    { key: "today", label: "Bugün", items: [] },
    { key: "week", label: "Bu hafta", items: [] },
    { key: "month", label: "Bu ay", items: [] },
    { key: "later", label: "Sonra", items: [] },
  ];
  const at = (k: PaymentGroup["key"]) => groups.find((g) => g.key === k)!.items;
  for (const p of items) {
    if (p.overdue) at("overdue").push(p);
    else if (p.date === today) at("today").push(p);
    else if (p.date <= week) at("week").push(p);
    else if (monthOf(p.date) === month) at("month").push(p);
    else at("later").push(p);
  }
  return groups.filter((g) => g.items.length > 0);
}
