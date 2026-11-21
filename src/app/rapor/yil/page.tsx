import type { Metadata } from "next";
import { getCategories, getProfile, getTransactionsBetween, getYearSummary } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { getNetWorthHistory } from "@/lib/net-worth-store";
import { getScope } from "@/lib/scope";
import { YearReportView } from "./year-report-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Yıllık rapor", robots: { index: false } };

export default async function YearReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { yil, yazdir } = await searchParams;
  const [scope, profile] = await Promise.all([getScope(), getProfile()]);
  const today = todayIn(profile.timezone);
  const thisYear = Number(today.slice(0, 4));
  const asked = Number(Array.isArray(yil) ? yil[0] : yil);
  const year = Number.isInteger(asked) && asked >= 2000 && asked <= thisYear ? asked : thisYear;

  const [transactions, summary, previous, categories, netHistory] = await Promise.all([
    getTransactionsBetween(`${year}-01-01`, `${year + 1}-01-01`),
    getYearSummary(year),
    getYearSummary(year - 1),
    getCategories(),
    // Net varlık kişiseldir: yalnızca kendi defterinde gösterilir.
    scope.shared ? Promise.resolve([]) : getNetWorthHistory(scope.actor.userId).catch(() => []),
  ]);

  return (
    <YearReportView
      ownerName={scope.ownerName}
      shared={scope.shared}
      today={today}
      year={year}
      thisYear={thisYear}
      firstYear={summary.firstYear}
      currency={profile.currency}
      autoPrint={yazdir === "1"}
      transactions={transactions}
      previous={previous}
      categories={categories}
      netHistory={netHistory}
    />
  );
}
