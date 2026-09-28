import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

// Yönetim paneli okumaları. Bilinçli olarak yalnızca hesap bilgisi ve kayıt SAYISI
// döner; kullanıcıların tutarları ve açıklamaları panelde gösterilmez.

export type AdminUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  disabled: boolean;
  createdMs: number;
  lastSeenMs: number | null;
  entries: number;
  devices: number;
};

export type AdminOverview = {
  users: AdminUser[];
  signupOpen: boolean;
  activeLast7Days: number;
  totalEntries: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireAdmin();
  const sql = db();
  const [users, settings] = await Promise.all([
    sql`
      select u.id::text as id, u.username, u.role, u.disabled_at is not null as disabled,
             (extract(epoch from u.created_at) * 1000)::float8 as "createdMs",
             (extract(epoch from u.last_seen_at) * 1000)::float8 as "lastSeenMs",
             coalesce(t.n, 0)::int as entries,
             coalesce(p.n, 0)::int as devices
        from users u
        left join (select user_id, count(*) as n from transactions group by user_id) t on t.user_id = u.id::text
        left join (select user_id, count(*) as n from push_subscriptions group by user_id) p on p.user_id = u.id::text
       order by u.created_at`,
    sql`select coalesce((select value from app_settings where key = 'signup_open'), 'true') = 'true' as open`,
  ]);

  const list = users as AdminUser[];
  const weekAgo = Date.now() - 7 * 86_400_000;
  return {
    users: list,
    signupOpen: Boolean((settings as { open: boolean }[])[0]?.open),
    activeLast7Days: list.filter((u) => u.lastSeenMs !== null && u.lastSeenMs >= weekAgo).length,
    totalEntries: list.reduce((s, u) => s + u.entries, 0),
  };
}
