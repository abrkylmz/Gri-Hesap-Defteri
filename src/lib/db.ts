import "server-only";
import { neon, NeonDbError, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

/** Neon HTTP sürücüsü: sunucusuz ortamlarda bağlantı havuzu gerektirmez. */
export function db() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL tanımlı değil (.env.example).");
    client = neon(url);
  }
  return client;
}

// bigint/date/timestamptz sütunları sürücüde string/Date döner; tipleri
// uygulamanın beklediği biçime (number / "YYYY-MM-DD") SQL'de çeviriyoruz.
export const TX_COLUMNS = `id, kind, amount::float8 as amount, category_id, note,
  occurred_on::text as occurred_on, recurring_id, remind_days, paid_at is not null as paid, template_id, loan_id,
  fx_code, fx_amount::float8 as fx_amount, fx_rate::float8 as fx_rate, created_at::text as created_at`;
export const CATEGORY_COLUMNS = `id, kind, name, emoji, monthly_budget::float8 as monthly_budget, sort`;
export const RECURRING_COLUMNS = `id, kind, amount::float8 as amount, category_id, note, day_of_month,
  starts_on::text as starts_on, active, remind_days`;

export const isDbError = (e: unknown): e is NeonDbError => e instanceof NeonDbError;
