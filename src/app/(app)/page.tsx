import type { Metadata } from "next";
import { LedgerView } from "@/components/ledger/ledger-view";
import {
  getMonthTransactions,
  getPlannedExpenses,
  getProfile,
  getRecurring,
  getTrend,
  materializeRecurring,
} from "@/lib/data";
import { isMonthKey, monthOf, todayIn } from "@/lib/dates";
import { dueReminders } from "@/lib/reminders";

export const metadata: Metadata = { title: "Defter" };

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ay } = await searchParams;
  const profile = await getProfile();
  const today = todayIn(profile.timezone);
  const current = monthOf(today);
  const month = isMonthKey(ay) ? ay : current;

  // Vadesi gelen düzenli kayıtları okumadan önce deftere işle.
  await materializeRecurring();

  const [transactions, trend, recurring, planned] = await Promise.all([
    getMonthTransactions(month),
    getTrend(month),
    getRecurring(),
    getPlannedExpenses(today),
  ]);

  return (
    <LedgerView
      key={month}
      month={month}
      today={today}
      transactions={transactions}
      trend={trend}
      recurring={month === current ? recurring : []}
      reminders={dueReminders(recurring, planned, today)}
    />
  );
}
