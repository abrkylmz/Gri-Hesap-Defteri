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
  /** null: tutar henüz belli değil ("tutar bekleniyor", şablondan boş uygulanan kalem) */
  amount: number | null;
  category_id: string | null;
  note: string | null;
  occurred_on: string;
  recurring_id: string | null;
  remind_days: number | null;
  /** Ödendi olarak işaretlendi mi (✓) */
  paid: boolean;
  /** Şablondan uygulandıysa şablonun id'si */
  template_id: string | null;
  /** Kredi taksitiyse kredinin id'si */
  loan_id: string | null;
  created_at: string;
};

export type LoanSummary = {
  id: string;
  name: string;
  principal: number | null;
  monthly_rate: number | null;
  term_months: number;
  first_due: string;
  installments: number;
  paid_count: number;
  paid_sum: number;
  remaining_sum: number;
  next_due: string | null;
  next_amount: number | null;
};

export type TemplateItem = {
  id: string;
  kind: EntryKind;
  /** null: tutarı her ay değişen kalem; şablon uygulanırken girilir */
  amount: number | null;
  category_id: string | null;
  note: string | null;
  day_of_month: number;
};

export type Template = {
  id: string;
  name: string;
  items: TemplateItem[];
  /** Görüntülenen ayda bu şablondan kaç kayıt var (uygulandı mı?) */
  appliedCount: number;
};
