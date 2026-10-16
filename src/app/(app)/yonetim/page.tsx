import type { Metadata } from "next";
import { getAdminOverview } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { recentErrors } from "@/lib/errors";
import { AdminPanel } from "./admin-panel";
import type { AnnouncementRow } from "./admin-extras";

export const metadata: Metadata = { title: "Yönetim", robots: { index: false } };

export default async function AdminPage() {
  const me = await requireAdmin();
  const [overview, errors, announcements] = await Promise.all([
    getAdminOverview(),
    recentErrors().catch(() => []),
    db()`select id::text as id, title, body, audience, delivered,
                 (extract(epoch from created_at) * 1000)::float8 as "createdMs"
            from announcements order by created_at desc limit 10`.catch(() => []),
  ]);
  return (
    <AdminPanel
      overview={overview}
      meId={me.userId}
      errors={errors}
      announcements={announcements as AnnouncementRow[]}
    />
  );
}
