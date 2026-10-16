import "server-only";
import { db } from "@/lib/db";
import type { NetWorthPoint } from "@/lib/net-worth";

/** Kişinin kendi kredilerinde ödenmemiş taksitlerin toplamı (kuruş). */
export async function ownLoansRemaining(userId: string): Promise<number> {
  const [row] = (await db()`
    select coalesce(sum(t.amount), 0)::float8 as n
      from transactions t join loans l on l.id = t.loan_id and l.user_id = t.user_id
     where t.user_id = ${userId} and t.paid_at is null and t.amount is not null`) as { n: number }[];
  return row?.n ?? 0;
}

/** Bugünün net varlık noktası (günde bir satır; gün içinde son değer kalır). */
export async function recordNetWorth(userId: string, day: string, assets: number, debts: number) {
  await db()`insert into net_worth_daily (user_id, day, assets, debts)
             values (${userId}, ${day}, ${Math.round(assets)}, ${Math.round(debts)})
             on conflict (user_id, day) do update set assets = excluded.assets, debts = excluded.debts`;
}

/** Son bir yılın noktaları, eskiden yeniye. */
export async function getNetWorthHistory(userId: string): Promise<NetWorthPoint[]> {
  return (await db()`
    select day::text as day, assets::float8 as assets, debts::float8 as debts
      from net_worth_daily
     where user_id = ${userId} and day >= current_date - 366
     order by day`) as NetWorthPoint[];
}
