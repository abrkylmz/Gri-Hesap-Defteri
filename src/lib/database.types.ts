// Supabase şemasının (supabase/schema.sql) elle tutulan tip karşılığı.
// Şema değişirse `npx supabase gen types typescript` ile yeniden üretilebilir.

export type EntryKind = "income" | "expense";

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  currency: string;
  timezone: string;
  created_at: string;
};

export type CategoryRow = {
  id: string;
  user_id: string;
  kind: EntryKind;
  name: string;
  emoji: string;
  monthly_budget: number | null;
  sort: number;
  created_at: string;
};

export type RecurringRow = {
  id: string;
  user_id: string;
  kind: EntryKind;
  amount: number;
  category_id: string | null;
  note: string | null;
  day_of_month: number;
  starts_on: string;
  active: boolean;
  created_at: string;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  kind: EntryKind;
  amount: number;
  category_id: string | null;
  note: string | null;
  occurred_on: string;
  recurring_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id">;
      categories: Table<CategoryRow, "kind" | "name">;
      recurring: Table<RecurringRow, "kind" | "amount" | "day_of_month">;
      transactions: Table<TransactionRow, "kind" | "amount" | "occurred_on">;
    };
    Views: { [_ in never]: never };
    Functions: {
      materialize_recurring: { Args: Record<string, never>; Returns: number };
      monthly_totals: {
        Args: { p_from: string; p_to: string };
        Returns: { month: string; income: number; expense: number }[];
      };
    };
    Enums: { entry_kind: EntryKind };
    CompositeTypes: { [_ in never]: never };
  };
};
