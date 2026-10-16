import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSupportStaff } from "@/lib/auth";
import { getSession } from "@/lib/data";
import { getInbox } from "@/lib/support";
import { InboxView } from "./inbox-view";

export const metadata: Metadata = { title: "Destek kutusu", robots: { index: false } };

export default async function SupportInboxPage() {
  const user = await getSession();
  if (!isSupportStaff(user)) notFound();
  return <InboxView initial={await getInbox()} />;
}
