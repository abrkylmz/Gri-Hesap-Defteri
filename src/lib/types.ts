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
  /** Yabancı parayla girildiyse: para birimi, o paradaki tutar (ör. 49.99) ve kullanılan kur */
  fx_code: FxCode | null;
  fx_amount: number | null;
  fx_rate: number | null;
  created_at: string;
};

export type FxCode = "USD" | "EUR" | "GBP";

export type LoanSummary = {
  id: string;
  name: string;
  bank: string | null;
  loan_type: "ihtiyac" | "tasit" | "konut" | "ticari" | null;
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

/** Kredinin bir taksiti (defterdeki kayıt) */
export type LoanInstallment = {
  id: string;
  loan_id: string;
  installment_no: number | null;
  amount: number | null;
  occurred_on: string;
  paid: boolean;
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
