import type { Metadata } from "next";
import { getProfile, getRecurring, getRecurringRuns, getUnpaidExpenses, materializeRecurring } from "@/lib/data";
import { shiftDate, todayIn } from "@/lib/dates";
import { HORIZON_DAYS, OVERDUE_DAYS, upcomingPayments } from "@/lib/payments";
import { PaymentsView } from "./payments-view";

export const metadata: Metadata = { title: "Yaklaşan ödemeler" };

export default async function PaymentsPage() {
  const [profile] = await Promise.all([getProfile(), materializeRecurring()]);
  const today = todayIn(profile.timezone);
  const [unpaid, recurring, runs] = await Promise.all([
    getUnpaidExpenses(shiftDate(today, -OVERDUE_DAYS), shiftDate(today, HORIZON_DAYS)),
    getRecurring(),
    getRecurringRuns(today),
  ]);
  return <PaymentsView payments={upcomingPayments(unpaid, recurring, today, new Set(runs))} today={today} />;
}
