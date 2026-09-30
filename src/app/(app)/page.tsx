import type { Metadata } from "next";
import { LedgerView } from "@/components/ledger/ledger-view";
import {
  getHoldings,
  getIpoOpenValue,
  getLoans,
  getWallets,
  getMonthTransactions,
  getPlannedExpenses,
  getProfile,
  getRecurring,
  getRecurringRuns,
  getTemplates,
  getTrend,
  materializeRecurring,
} from "@/lib/data";
import { isMonthKey, monthOf, todayIn } from "@/lib/dates";
import { dueReminders } from "@/lib/reminders";
import { getRates } from "@/lib/fx";
import { getScope } from "@/lib/scope";

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

  const scope = await getScope();
  const [transactions, trend, recurring, planned, runs, templates, rates, holdings, wallets, ipoValue, loans] =
    await Promise.all([
    getMonthTransactions(month),
    getTrend(month),
    getRecurring(),
    getPlannedExpenses(today),
    getRecurringRuns(today),
    getTemplates(month),
    // Kur kaynağına ulaşılamasa bile defter açılsın.
    getRates().catch((e) => {
      console.error("[fx]", e);
      return [];
    }),
    getHoldings(),
    getWallets(),
    getIpoOpenValue().catch((e) => {
      console.error("[varlıklar] halka arz", e);
      return 0;
    }),
    // Kredi borcu yalnızca kendi defterinde varlıklardan düşülür (paylaşılan defterin kredisi başkasınındır).
    scope.shared ? Promise.resolve([]) : getLoans(),
  ]);
  const doneRuns = new Set(runs);

  return (
    <LedgerView
      key={month}
      month={month}
      today={today}
      transactions={transactions}
      trend={trend}
      recurring={month === current ? recurring : []}
      reminders={dueReminders(recurring, planned, today, doneRuns)}
      doneRuns={runs}
      templates={templates}
      rates={rates}
      holdings={holdings}
      wallets={wallets}
      ipoValue={ipoValue}
      loanDebt={loans.reduce((s, l) => s + l.remaining_sum, 0)}
    />
  );
}
