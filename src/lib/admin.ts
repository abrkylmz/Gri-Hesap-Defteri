import "server-only";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { vapidPublicKey } from "@/lib/push";

// Yönetim paneli okumaları. Bilinçli olarak yalnızca hesap bilgisi ve kayıt SAYISI
// döner; kullanıcıların tutarları ve açıklamaları panelde gösterilmez.

export type AdminUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  /** Destek moderatörü */
  supportAgent: boolean;
  disabled: boolean;
  createdMs: number;
  lastSeenMs: number | null;
  entries: number;
  devices: number;
  /** Son 7 günde eklediği kayıt sayısı */
  entriesWeek: number;
};

/** Günlük sayılar (yalnızca adet; tutar ya da açıklama yok). */
export type DayCount = { day: string; entries: number; signups: number };

export type AdminOverview = {
  users: AdminUser[];
  signupOpen: boolean;
  activeLast7Days: number;
  activeToday: number;
  totalEntries: number;
  entriesThisWeek: number;
  newUsersThisWeek: number;
  /** Son 30 gün, eskiden yeniye (İstanbul saatine göre) */
  daily: DayCount[];
  /** Zamanlanmış görevin (hatırlatmalar) son çalışması */
  cronLastRunMs: number | null;
  /** Görev son 36 saatte çalıştı mı */
  cronHealthy: boolean;
  pushConfigured: boolean;
  /** Yanıt bekleyen destek sohbetleri */
  supportWaiting: number;
  /** Veritabanı yanıt süresi (ms) */
  dbMs: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireAdmin();
  const sql = db();
  const t0 = performance.now();
  await sql`select 1`;
  const dbMs = Math.round(performance.now() - t0);
  const [users, settings, daily, extra, publicKey] = await Promise.all([
    sql`
      select u.id::text as id, u.username, u.role, u.support_agent as "supportAgent", u.disabled_at is not null as disabled,
             (extract(epoch from u.created_at) * 1000)::float8 as "createdMs",
             (extract(epoch from u.last_seen_at) * 1000)::float8 as "lastSeenMs",
             coalesce(t.n, 0)::int as entries,
             coalesce(p.n, 0)::int as devices,
             coalesce(t.week, 0)::int as "entriesWeek"
        from users u
        left join (select user_id, count(*) as n, count(*) filter (where created_at > now() - interval '7 days') as week
                     from transactions group by user_id) t on t.user_id = u.id::text
        left join (select user_id, count(*) as n from push_subscriptions group by user_id) p on p.user_id = u.id::text
       order by u.created_at`,
    sql`select coalesce((select value from app_settings where key = 'signup_open'), 'true') = 'true' as open`,
    sql`
      with days as (
        select generate_series((now() at time zone 'Europe/Istanbul')::date - 29,
                               (now() at time zone 'Europe/Istanbul')::date, interval '1 day')::date as day
      )
      select d.day::text as day,
             (select count(*) from transactions t
               where (t.created_at at time zone 'Europe/Istanbul')::date = d.day)::int as entries,
             (select count(*) from users u
               where (u.created_at at time zone 'Europe/Istanbul')::date = d.day)::int as signups
        from days d order by d.day`,
    sql`select (select (extract(epoch from updated_at) * 1000)::float8 from app_settings where key = 'cron_last_run') as cron,
               (select count(*) from support_threads where status = 'open' and not last_from_staff
                  and (staff_read_at is null or staff_read_at < last_message_at))::int as support`,
    vapidPublicKey().catch(() => null),
  ]);

  const list = users as AdminUser[];
  const weekAgo = Date.now() - 7 * 86_400_000;
  return {
    users: list,
    signupOpen: Boolean((settings as { open: boolean }[])[0]?.open),
    activeLast7Days: list.filter((u) => u.lastSeenMs !== null && u.lastSeenMs >= weekAgo).length,
    activeToday: list.filter((u) => u.lastSeenMs !== null && u.lastSeenMs >= Date.now() - 86_400_000).length,
    totalEntries: list.reduce((s, u) => s + u.entries, 0),
    entriesThisWeek: list.reduce((s, u) => s + u.entriesWeek, 0),
    newUsersThisWeek: list.filter((u) => u.createdMs >= weekAgo).length,
    daily: daily as DayCount[],
    cronLastRunMs: (extra as { cron: number | null }[])[0]?.cron ?? null,
    cronHealthy: ((extra as { cron: number | null }[])[0]?.cron ?? 0) > Date.now() - 36 * 3_600_000,
    pushConfigured: publicKey !== null,
    supportWaiting: (extra as { support: number }[])[0]?.support ?? 0,
    dbMs,
  };
}
