// Yaklaşan ödeme hatırlatmaları: hem uygulama içi şerit hem sabah bildirimi bu
// saf fonksiyonları kullanır; böylece ikisi her zaman aynı listeyi görür.

import type { RecurringRow, TransactionRow } from "@/lib/types";
import { addMonths, dateInMonth, dayMonthShort, monthOf } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export type Reminder = {
  /** Ödemenin kaynağı (düzenli kaydın ya da işlemin id'si) */
  sourceId: string;
  type: "recurring" | "once";
  due: string;
  daysLeft: number;
  amount: number;
  note: string | null;
  categoryId: string | null;
  transaction?: TransactionRow;
};

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Düzenli kaydın bugün ya da sonrasındaki ilk vade tarihi. */
export function nextRecurringDue(r: Pick<RecurringRow, "day_of_month" | "starts_on">, today: string): string {
  const from = r.starts_on > today ? r.starts_on : today;
  const month = monthOf(from);
  const candidate = dateInMonth(month, r.day_of_month);
  return candidate >= from ? candidate : dateInMonth(addMonths(month, 1), r.day_of_month);
}

/** Hatırlatma penceresine girmiş (0 ≤ kalan gün ≤ remind_days) gider ödemeleri, vadeye göre sıralı. */
export function dueReminders(
  recurring: RecurringRow[],
  transactions: TransactionRow[],
  today: string,
): Reminder[] {
  const list: Reminder[] = [];

  for (const r of recurring) {
    if (!r.active || r.kind !== "expense" || r.remind_days === null) continue;
    const due = nextRecurringDue(r, today);
    const daysLeft = daysBetween(today, due);
    if (daysLeft <= r.remind_days) {
      list.push({
        sourceId: r.id,
        type: "recurring",
        due,
        daysLeft,
        amount: r.amount,
        note: r.note,
        categoryId: r.category_id,
      });
    }
  }

  for (const t of transactions) {
    // Düzenli kayıttan üretilmiş işlemler zaten düzenli kaydın kendisiyle hatırlatılır.
    if (t.kind !== "expense" || t.remind_days === null || t.recurring_id) continue;
    const daysLeft = daysBetween(today, t.occurred_on);
    if (daysLeft >= 0 && daysLeft <= t.remind_days) {
      list.push({
        sourceId: t.id,
        type: "once",
        due: t.occurred_on,
        daysLeft,
        amount: t.amount,
        note: t.note,
        categoryId: t.category_id,
        transaction: t,
      });
    }
  }

  return list.sort((a, b) => a.due.localeCompare(b.due) || b.amount - a.amount);
}

export function whenLabel(daysLeft: number): string {
  if (daysLeft <= 0) return "bugün";
  if (daysLeft === 1) return "yarın";
  if (daysLeft === 7) return "1 hafta sonra";
  return `${daysLeft} gün sonra`;
}

/** Hatırlatmanın okunur başlığı: açıklama > kategori adı > "Ödeme". */
export const reminderTitle = (r: Pick<Reminder, "note" | "categoryId">, categoryName: (id: string) => string | undefined) =>
  r.note || (r.categoryId ? categoryName(r.categoryId) : undefined) || "Ödeme";

/** Bir kullanıcının o sabahki hatırlatmalarını tek bildirimde toplar. */
export function reminderNotification(
  items: Reminder[],
  categoryName: (id: string) => string | undefined,
  currency: string,
): { title: string; body: string } {
  const line = (r: Reminder) =>
    `${reminderTitle(r, categoryName)} · ${whenLabel(r.daysLeft)} · ${formatMoney(r.amount, currency)}`;
  const first = items[0];
  if (items.length === 1 && first) {
    return {
      title: `${reminderTitle(first, categoryName)} ${whenLabel(first.daysLeft)}`,
      body: `${formatMoney(first.amount, currency)} · ${dayMonthShort(first.due)}`,
    };
  }
  const total = items.reduce((s, r) => s + r.amount, 0);
  return {
    title: `${items.length} ödeme yaklaşıyor · ${formatMoney(total, currency)}`,
    body: items.slice(0, 5).map(line).join("\n") + (items.length > 5 ? `\n+${items.length - 5} ödeme daha` : ""),
  };
}
