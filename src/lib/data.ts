import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { CATEGORY_COLUMNS, db, RECURRING_COLUMNS, TX_COLUMNS } from "@/lib/db";
import type { CategoryRow, RecurringRow, TransactionRow } from "@/lib/types";
import { addMonths, DEFAULT_TZ, monthStart } from "@/lib/dates";

// Her okuma oturumdaki kullanıcıyla sınırlıdır: user_id istemciden asla alınmaz.

export type Profile = { currency: string; timezone: string };
export type MonthTotal = { month: string; income: number; expense: number };

export const getSession = cache(requireUser);

/** Profil; ilk girişte profil ve varsayılan kategoriler oluşturulur. */
export const getProfile = cache(async (): Promise<Profile> => {
  const { userId } = await getSession();
  const sql = db();
  const rows = (await sql`select currency, timezone from profiles where user_id = ${userId}`) as Profile[];
  if (rows[0]) return rows[0];
  await sql`select ensure_user(${userId}, ${DEFAULT_TZ})`;
  return { currency: "TRY", timezone: DEFAULT_TZ };
});

export const getCategories = cache(async (): Promise<CategoryRow[]> => {
  const { userId } = await getSession();
  await getProfile(); // varsayılan kategoriler önce oluşsun
  const sql = db();
  return (await sql`select ${sql.unsafe(CATEGORY_COLUMNS)} from categories
    where user_id = ${userId} order by sort, name`) as CategoryRow[];
});

export const getRecurring = cache(async (): Promise<RecurringRow[]> => {
  const { userId } = await getSession();
  const sql = db();
  return (await sql`select ${sql.unsafe(RECURRING_COLUMNS)} from recurring
    where user_id = ${userId} order by day_of_month, created_at`) as RecurringRow[];
});

/** Vadesi gelmiş düzenli kayıtları deftere işler (idempotent). */
export const materializeRecurring = cache(async () => {
  const { userId } = await getSession();
  try {
    await db()`select materialize_recurring(${userId})`;
  } catch (e) {
    console.error("materialize_recurring", e);
  }
});

export async function getTransactionsBetween(from: string, toExclusive: string) {
  const { userId } = await getSession();
  const sql = db();
  return (await sql`select ${sql.unsafe(TX_COLUMNS)} from transactions
    where user_id = ${userId} and occurred_on >= ${from} and occurred_on < ${toExclusive}
    order by occurred_on desc, created_at desc`) as TransactionRow[];
}

/** Hatırlatması açık, bugünden sonraki 31 gün içindeki planlı giderler. */
export async function getPlannedExpenses(today: string) {
  const { userId } = await getSession();
  const sql = db();
  return (await sql`select ${sql.unsafe(TX_COLUMNS)} from transactions
    where user_id = ${userId} and kind = 'expense' and remind_days is not null
      and occurred_on between ${today}::date and ${today}::date + 31`) as TransactionRow[];
}

export const getMonthTransactions = (month: string) =>
  getTransactionsBetween(monthStart(month), monthStart(addMonths(month, 1)));

/** Seçili ay dahil son `span` ayın gelir/gider toplamları (eksik aylar sıfır). */
export async function getTrend(month: string, span = 6): Promise<MonthTotal[]> {
  const { userId } = await getSession();
  const first = addMonths(month, -(span - 1));
  const rows = (await db()`
    select to_char(date_trunc('month', occurred_on), 'YYYY-MM') as month,
           coalesce(sum(amount) filter (where kind = 'income'), 0)::float8 as income,
           coalesce(sum(amount) filter (where kind = 'expense'), 0)::float8 as expense
      from transactions
     where user_id = ${userId}
       and occurred_on >= ${monthStart(first)} and occurred_on < ${monthStart(addMonths(month, 1))}
     group by 1`) as MonthTotal[];
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: span }, (_, i) => {
    const m = addMonths(first, i);
    const r = byMonth.get(m);
    return { month: m, income: Number(r?.income ?? 0), expense: Number(r?.expense ?? 0) };
  });
}
