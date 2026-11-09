import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db, RECURRING_COLUMNS, TX_COLUMNS } from "@/lib/db";
import { shiftDate, todayIn } from "@/lib/dates";
import { fundStats, fundTotals, type Fund, type FundValue } from "@/lib/funds";
import { formatMoney } from "@/lib/money";
import { OVERDUE_DAYS, todaySummary, upcomingPayments } from "@/lib/payments";
import type { RecurringRow, TransactionRow } from "@/lib/types";

// iPhone widget'ı (Scriptable): kişiye özel, yalnızca okuma yapan anahtar. Veritabanında yalnızca özeti tutulur.

export const newWidgetToken = () => `gw_${randomBytes(24).toString("base64url")}`;
export const hashWidgetToken = (token: string) => createHash("sha256").update(`gri-widget:${token}`).digest("hex");

/** Anahtarın sahibi (devre dışı hesaplar hariç). */
export async function widgetUser(token: string) {
  if (!/^gw_[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [u] = (await db()`select id::text as id, username, role from users
    where widget_token_hash = ${hashWidgetToken(token)} and disabled_at is null`) as {
    id: string;
    username: string;
    role: string;
  }[];
  return u ?? null;
}

const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });
const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 2, signDisplay: "exceptZero" });

/** Widget'ın gösterdiği özet: bugünün ödemeleri, gecikmişler, sıradaki ödeme, ayın durumu; yöneticiye fonlar. */
export async function widgetData(user: { id: string; role: string }) {
  const sql = db();
  const [profile] = (await sql`select coalesce(timezone, 'Europe/Istanbul') as tz, coalesce(currency, 'TRY') as currency
    from profiles where user_id = ${user.id}`) as { tz: string; currency: string }[];
  const tz = profile?.tz ?? "Europe/Istanbul";
  const currency = profile?.currency ?? "TRY";
  const today = todayIn(tz);
  const month = today.slice(0, 7);
  const money = (minor: number, sign = false) => formatMoney(minor, currency, { sign });

  const [unpaid, recurring, runs, monthSum, categories, funds, values] = await Promise.all([
    sql`select ${sql.unsafe(TX_COLUMNS)} from transactions
         where user_id = ${user.id} and kind = 'expense' and paid_at is null
           and occurred_on between ${shiftDate(today, -OVERDUE_DAYS)}::date and ${shiftDate(today, 14)}::date
         order by occurred_on`,
    sql`select ${sql.unsafe(RECURRING_COLUMNS)} from recurring where user_id = ${user.id}`,
    sql`select rr.recurring_id::text || '|' || to_char(rr.period, 'YYYY-MM') as key
          from recurring_runs rr join recurring r on r.id = rr.recurring_id
         where r.user_id = ${user.id} and rr.period >= date_trunc('month', ${today}::date)`,
    sql`select coalesce(sum(amount) filter (where kind = 'income'), 0)::float8 as income,
               coalesce(sum(amount) filter (where kind = 'expense'), 0)::float8 as expense
          from transactions where user_id = ${user.id} and amount is not null
           and to_char(occurred_on, 'YYYY-MM') = ${month}`,
    sql`select id::text as id, name from categories where user_id = ${user.id}`,
    user.role === "admin"
      ? sql`select id::text as id, name, code, invested::float8 as invested, sort from funds where user_id = ${user.id}`
      : Promise.resolve([]),
    user.role === "admin"
      ? sql`select v.fund_id::text as "fundId", v.day::text as day, v.value::float8 as value
              from fund_values v join funds f on f.id = v.fund_id
             where f.user_id = ${user.id} and v.day >= current_date - 30`
      : Promise.resolve([]),
  ]);

  const names = new Map((categories as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const payments = upcomingPayments(
    unpaid as TransactionRow[],
    recurring as RecurringRow[],
    today,
    new Set((runs as { key: string }[]).map((r) => r.key)),
    14,
  );
  const s = todaySummary(payments, today);
  const label = (p: { note: string | null; categoryId: string | null }) =>
    p.note || (p.categoryId ? names.get(p.categoryId) : null) || "Ödeme";
  const next = payments.find((p) => p.date > today) ?? null;
  const m = (monthSum as { income: number; expense: number }[])[0] ?? { income: 0, expense: 0 };
  const date = new Date(`${today}T00:00:00Z`);

  let fundsOut = null;
  if ((funds as Fund[]).length) {
    const t = fundTotals(fundStats(funds as Fund[], values as FundValue[]));
    fundsOut = {
      value: money(t.value),
      daily: t.daily === null ? null : money(t.daily, true),
      dailyPct: t.dailyPct === null ? null : pct.format(t.dailyPct),
      dailyUp: (t.daily ?? 0) >= 0,
      total: money(t.total, true),
      totalPct: t.totalPct === null ? null : pct.format(t.totalPct),
      totalUp: t.total >= 0,
      net: money(t.net, true),
      netPct: t.netPct === null ? null : pct.format(t.netPct),
    };
  }

  return {
    date: today,
    day: date.getUTCDate(),
    weekday: weekday.format(date),
    dayMonth: dayMonth.format(date),
    today: {
      count: s.dueToday.length,
      total: money(s.todayTotal),
      items: s.dueToday
        .slice(0, 4)
        .map((p) => ({ name: label(p), amount: p.amount === null ? "tutar bekleniyor" : money(p.amount) })),
    },
    overdue: { count: s.overdue.length, total: money(s.overdueTotal) },
    next: next
      ? {
          name: label(next),
          amount: next.amount === null ? "—" : money(next.amount),
          when: dayMonth.format(new Date(`${next.date}T00:00:00Z`)),
        }
      : null,
    month: {
      income: money(m.income),
      expense: money(m.expense),
      net: money(m.income - m.expense, true),
      up: m.income >= m.expense,
    },
    funds: fundsOut,
    generatedAt: new Date().toISOString(),
  };
}
