import type { Metadata } from "next";
import { getCategories, getMonthTransactions, getProfile, getRecurring, getTrend } from "@/lib/data";
import { addMonths, isMonthKey, monthOf, todayIn } from "@/lib/dates";
import { getNetWorthHistory } from "@/lib/net-worth-store";
import { getScope } from "@/lib/scope";
import { ReportView } from "./report-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aylık rapor", robots: { index: false } };

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ay, yazdir } = await searchParams;
  const [scope, profile] = await Promise.all([getScope(), getProfile()]);
  const today = todayIn(profile.timezone);
  const month = isMonthKey(ay) ? ay : monthOf(today);
  const [transactions, previous, next, categories, trend, recurring, netHistory] = await Promise.all([
    getMonthTransactions(month),
    getMonthTransactions(addMonths(month, -1)),
    getMonthTransactions(addMonths(month, 1)),
    getCategories(),
    getTrend(month),
    getRecurring(),
    // Net varlık kişiseldir: yalnızca kendi defterinde gösterilir.
    scope.shared ? Promise.resolve([]) : getNetWorthHistory(scope.actor.userId).catch(() => []),
  ]);

  return (
    <ReportView
      ownerName={scope.ownerName}
      shared={scope.shared}
      today={today}
      month={month}
      currency={profile.currency}
      autoPrint={yazdir === "1"}
      transactions={transactions}
      previous={previous}
      next={next}
      categories={categories}
      trend={trend}
      recurring={recurring}
      netHistory={netHistory}
    />
  );
}
