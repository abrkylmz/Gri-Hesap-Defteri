import type { Metadata } from "next";
import { getRecurring } from "@/lib/data";
import { RecurringManager } from "./recurring-manager";

export const metadata: Metadata = { title: "Düzenli kayıtlar" };

export default async function RecurringPage() {
  const recurring = await getRecurring();
  return <RecurringManager recurring={recurring} />;
}
