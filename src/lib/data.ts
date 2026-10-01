import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { CATEGORY_COLUMNS, db, RECURRING_COLUMNS, TX_COLUMNS } from "@/lib/db";
import { getScope } from "@/lib/scope";
import type { CategoryRow, LoanSummary, RecurringRow, Template, TemplateItem, TransactionRow } from "@/lib/types";
import type { Ipo, IpoAccount, IpoAllocation, IpoSale } from "@/lib/ipo";
import type { Holding } from "@/lib/assets";
import type { Wallet } from "@/lib/wallets";
import { addMonths, DEFAULT_TZ, monthStart } from "@/lib/dates";

// Defter verisi (işlemler, kategoriler, düzenli kayıtlar, profil) SEÇİLİ DEFTERİN sahibine göre
// okunur; sahiplik/üyelik getScope() içinde her istekte doğrulanır. Halka arz verisi kişiseldir
// ve her zaman oturumdaki kullanıcıya göre okunur. Kimlikler istemciden asla alınmaz.

export type Profile = { currency: string; timezone: string };
export type MonthTotal = { month: string; income: number; expense: number };

/** Oturumdaki kullanıcı (defter seçiminden bağımsız). */
export const getSession = cache(requireUser);

const ledgerOwner = async () => (await getScope()).ownerId;

/** Seçili defterin profili; kendi defterinde ilk girişte profil ve varsayılan kategoriler oluşur. */
export const getProfile = cache(async (): Promise<Profile> => {
  const scope = await getScope();
  const sql = db();
  const rows = (await sql`select currency, timezone from profiles where user_id = ${scope.ownerId}`) as Profile[];
  if (rows[0]) return rows[0];
  if (!scope.shared) await sql`select ensure_user(${scope.ownerId}, ${DEFAULT_TZ})`;
  return { currency: "TRY", timezone: DEFAULT_TZ };
});

export const getCategories = cache(async (): Promise<CategoryRow[]> => {
  const owner = await ledgerOwner();
  await getProfile(); // varsayılan kategoriler önce oluşsun
  const sql = db();
  return (await sql`select ${sql.unsafe(CATEGORY_COLUMNS)} from categories
    where user_id = ${owner} order by sort, name`) as CategoryRow[];
});

export const getRecurring = cache(async (): Promise<RecurringRow[]> => {
  const owner = await ledgerOwner();
  const sql = db();
  return (await sql`select ${sql.unsafe(RECURRING_COLUMNS)} from recurring
    where user_id = ${owner} order by day_of_month, created_at`) as RecurringRow[];
});

/** Vadesi gelmiş düzenli kayıtları deftere işler (idempotent). */
export const materializeRecurring = cache(async () => {
  const owner = await ledgerOwner();
  try {
    await db()`select materialize_recurring(${owner})`;
  } catch (e) {
    console.error("materialize_recurring", e);
  }
});

export async function getTransactionsBetween(from: string, toExclusive: string) {
  const owner = await ledgerOwner();
  const sql = db();
  return (await sql`select ${sql.unsafe(TX_COLUMNS)} from transactions
    where user_id = ${owner} and occurred_on >= ${from} and occurred_on < ${toExclusive}
    order by occurred_on desc, created_at desc`) as TransactionRow[];
}

/** Halka arz defterinin tamamı — kişiseldir, paylaşılmaz. */
export async function getIpoData() {
  const { userId } = await getSession();
  const sql = db();
  const [accounts, ipos, allocations, sales] = await Promise.all([
    sql`select id, name, sort from ipo_accounts where user_id = ${userId} order by sort, created_at`,
    sql`select id, code, name, offer_price::float8 as offer_price, listed_on::text as listed_on,
               current_price::float8 as current_price,
               (extract(epoch from price_updated_at) * 1000)::float8 as price_updated_ms
          from ipos where user_id = ${userId}
         order by coalesce(listed_on, created_at::date) desc, created_at desc`,
    sql`select id, ipo_id, account_id, lots from ipo_allocations where user_id = ${userId}`,
    sql`select id, allocation_id, lots, price::float8 as price, commission::float8 as commission,
               sold_on::text as sold_on
          from ipo_sales where user_id = ${userId}`,
  ]);
  return {
    accounts: accounts as IpoAccount[],
    ipos: ipos as Ipo[],
    allocations: allocations as IpoAllocation[],
    sales: sales as IpoSale[],
  };
}

/** Bu aydan itibaren işlenmiş (ya da erken ödenmiş) düzenli kayıt dönemleri: "id|YYYY-MM". */
export async function getRecurringRuns(today: string): Promise<string[]> {
  const owner = await ledgerOwner();
  const rows = (await db()`
    select rr.recurring_id::text || '|' || to_char(rr.period, 'YYYY-MM') as key
      from recurring_runs rr join recurring r on r.id = rr.recurring_id
     where r.user_id = ${owner} and rr.period >= date_trunc('month', ${today}::date)`) as { key: string }[];
  return rows.map((r) => r.key);
}

/** Şablonlar, satırları ve görüntülenen ayda uygulanıp uygulanmadıkları. */
export async function getTemplates(month: string): Promise<Template[]> {
  const owner = await ledgerOwner();
  const sql = db();
  const [templates, items, applied] = await Promise.all([
    sql`select id, name from templates where user_id = ${owner} order by created_at`,
    sql`select id, template_id, kind, amount::float8 as amount, category_id, note, day_of_month
          from template_items where user_id = ${owner} order by sort, day_of_month`,
    sql`select template_id, count(*)::int as n from transactions
          where user_id = ${owner} and template_id is not null
            and occurred_on >= ${monthStart(month)} and occurred_on < ${monthStart(addMonths(month, 1))}
          group by template_id`,
  ]);
  const byTemplate = new Map<string, TemplateItem[]>();
  for (const it of items as (TemplateItem & { template_id: string })[]) {
    const { template_id, ...item } = it;
    byTemplate.set(template_id, [...(byTemplate.get(template_id) ?? []), item]);
  }
  const appliedMap = new Map((applied as { template_id: string; n: number }[]).map((a) => [a.template_id, a.n]));
  return (templates as { id: string; name: string }[]).map((t) => ({
    ...t,
    items: byTemplate.get(t.id) ?? [],
    appliedCount: appliedMap.get(t.id) ?? 0,
  }));
}

/** Kişinin döviz/altın birikimleri (kişiseldir, defter paylaşımından bağımsız). */
export async function getHoldings(): Promise<Holding[]> {
  const { userId } = await getSession();
  return (await db()`select id, asset, amount::float8 as amount, cost::float8 as cost, note
    from holdings where user_id = ${userId} order by created_at`) as Holding[];
}

/** Seçili defterin kredileri ve taksit durumları. */
export async function getLoans(): Promise<LoanSummary[]> {
  const owner = await ledgerOwner();
  return (await db()`
    select l.id, l.name, l.principal::float8 as principal, l.monthly_rate::float8 as monthly_rate,
           l.term_months, l.first_due::text as first_due,
           count(t.id)::int as installments,
           count(t.id) filter (where t.paid_at is not null)::int as paid_count,
           coalesce(sum(t.amount) filter (where t.paid_at is not null), 0)::float8 as paid_sum,
           coalesce(sum(t.amount) filter (where t.paid_at is null), 0)::float8 as remaining_sum,
           (min(t.occurred_on) filter (where t.paid_at is null))::text as next_due,
           ((array_agg(t.amount order by t.occurred_on) filter (where t.paid_at is null))[1])::float8 as next_amount
      from loans l
      left join transactions t on t.loan_id = l.id and t.user_id = l.user_id
     where l.user_id = ${owner}
     group by l.id
     order by l.created_at desc`) as LoanSummary[];
}

/** Hatırlatması açık, bugünden sonraki 31 gün içindeki planlı giderler. */
export async function getPlannedExpenses(today: string) {
  const owner = await ledgerOwner();
  const sql = db();
  return (await sql`select ${sql.unsafe(TX_COLUMNS)} from transactions
    where user_id = ${owner} and kind = 'expense' and remind_days is not null and paid_at is null
      and occurred_on between ${today}::date and ${today}::date + 31`) as TransactionRow[];
}

export const getMonthTransactions = (month: string) =>
  getTransactionsBetween(monthStart(month), monthStart(addMonths(month, 1)));

/** Seçili ay dahil son `span` ayın gelir/gider toplamları (eksik aylar sıfır). */
export async function getTrend(month: string, span = 6): Promise<MonthTotal[]> {
  const owner = await ledgerOwner();
  const first = addMonths(month, -(span - 1));
  const rows = (await db()`
    select to_char(date_trunc('month', occurred_on), 'YYYY-MM') as month,
           coalesce(sum(amount) filter (where kind = 'income'), 0)::float8 as income,
           coalesce(sum(amount) filter (where kind = 'expense'), 0)::float8 as expense
      from transactions
     where user_id = ${owner}
       and occurred_on >= ${monthStart(first)} and occurred_on < ${monthStart(addMonths(month, 1))}
     group by 1`) as MonthTotal[];
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: span }, (_, i) => {
    const m = addMonths(first, i);
    const r = byMonth.get(m);
    return { month: m, income: Number(r?.income ?? 0), expense: Number(r?.expense ?? 0) };
  });
}

/** Kişinin varlık yerleri (cüzdanlar). */
export async function getWallets(): Promise<Wallet[]> {
  const { userId } = await getSession();
  return (await db()`select id, name, kind, balance::float8 as balance,
                            (extract(epoch from updated_at) * 1000)::float8 as updated_ms
                       from wallets where user_id = ${userId} and kind <> 'card'
                      order by sort, created_at`) as Wallet[];
}
