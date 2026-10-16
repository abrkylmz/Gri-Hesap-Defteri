import type { Metadata } from "next";
import { LedgerView } from "@/components/ledger/ledger-view";
import {
  getGoals,
  getOnboarding,
  getHoldings,
  getWallets,
  getWatchList,
  getHomeLayout,
  getMonthTransactions,
  getPlannedExpenses,
  getProfile,
  getRecurring,
  getRecurringRuns,
  getTemplates,
  getTrend,
  getUnpaidExpenses,
  materializeRecurring,
} from "@/lib/data";
import { isMonthKey, monthOf, shiftDate, todayIn } from "@/lib/dates";
import { OVERDUE_DAYS, upcomingPayments } from "@/lib/payments";
import { dueReminders } from "@/lib/reminders";
import { getRates } from "@/lib/fx";

export const metadata: Metadata = { title: "Defter" };

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ay } = await searchParams;
  // Profil ve vadesi gelen düzenli kayıtların işlenmesi birbirini beklemez (paralel).
  const [profile] = await Promise.all([getProfile(), materializeRecurring()]);
  const today = todayIn(profile.timezone);
  const current = monthOf(today);
  const month = isMonthKey(ay) ? ay : current;

  const [
    transactions,
    trend,
    recurring,
    planned,
    runs,
    templates,
    rates,
    holdings,
    wallets,
    watch,
    layout,
    goals,
    onboarding,
    unpaid,
  ] = await Promise.all([
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
    getWatchList(),
    getHomeLayout(),
    getGoals(),
    getOnboarding().catch(() => null),
    // "Bugün" kartı: bugünkü ve gecikmiş ödemeler (son 45 gün)
    getUnpaidExpenses(shiftDate(today, -OVERDUE_DAYS), today),
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
      watch={watch}
      layout={layout}
      goals={goals}
      onboarding={onboarding}
      todayPayments={upcomingPayments(unpaid, [], today, new Set(runs), 0)}
    />
  );
}
