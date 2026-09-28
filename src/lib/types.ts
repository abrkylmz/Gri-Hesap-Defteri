// Veritabanı satırlarının (db/schema.sql) uygulamadaki karşılıkları.
// user_id bilinçli olarak dışarıda: istemciye hiç gönderilmez.

export type EntryKind = "income" | "expense";

export type CategoryRow = {
  id: string;
  kind: EntryKind;
  name: string;
  emoji: string;
  monthly_budget: number | null;
  sort: number;
};

export type RecurringRow = {
  id: string;
  kind: EntryKind;
  amount: number;
  category_id: string | null;
  note: string | null;
  day_of_month: number;
  starts_on: string;
  active: boolean;
  remind_days: number | null;
};

export type TransactionRow = {
  id: string;
  kind: EntryKind;
  amount: number;
  category_id: string | null;
  note: string | null;
  occurred_on: string;
  recurring_id: string | null;
  remind_days: number | null;
  created_at: string;
};
