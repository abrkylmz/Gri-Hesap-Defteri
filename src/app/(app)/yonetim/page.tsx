import type { Metadata } from "next";
import { getAdminOverview } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { AdminPanel } from "./admin-panel";

export const metadata: Metadata = { title: "Yönetim", robots: { index: false } };

export default async function AdminPage() {
  const me = await requireAdmin();
  const overview = await getAdminOverview();
  return <AdminPanel overview={overview} meId={me.userId} />;
}
