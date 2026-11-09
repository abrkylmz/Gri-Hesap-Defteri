import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getFunds, getProfile } from "@/lib/data";
import { todayIn } from "@/lib/dates";
import { FundsView } from "./funds-view";

export const metadata: Metadata = { title: "Fon getirisi", robots: { index: false } };

/** Fon getiri takibi — yalnızca yönetici (diğerleri için sayfa yok gibi davranır). */
export default async function FundsPage() {
  const me = await requireAdmin();
  const [profile, data] = await Promise.all([getProfile(), getFunds(me.userId)]);
  return <FundsView funds={data.funds} values={data.values} today={todayIn(profile.timezone)} />;
}
