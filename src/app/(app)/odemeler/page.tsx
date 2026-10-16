import type { Metadata } from "next";
import {
  getLimits,
  getProfile,
  getRecurring,
  getRecurringRuns,
  getUnpaidExpenses,
  materializeRecurring,
} from "@/lib/data";
import { shiftDate, todayIn } from "@/lib/dates";
import { HORIZON_DAYS, OVERDUE_DAYS, upcomingPayments } from "@/lib/payments";
import { PaymentsView } from "./payments-view";

export const metadata: Metadata = { title: "Yaklaşan ödemeler" };

export default async function PaymentsPage() {
  const [profile] = await Promise.all([getProfile(), materializeRecurring()]);
  const today = todayIn(profile.timezone);
  const [unpaid, recurring, runs, limits] = await Promise.all([
    getUnpaidExpenses(shiftDate(today, -OVERDUE_DAYS), shiftDate(today, HORIZON_DAYS)),
    getRecurring(),
    getRecurringRuns(today),
    getLimits(),
  ]);
  return (
    <PaymentsView
      payments={upcomingPayments(unpaid, recurring, today, new Set(runs))}
      today={today}
      cards={limits.filter((l) => l.kind === "card" && l.due_day)}
    />
  );
}
