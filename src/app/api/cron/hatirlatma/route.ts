import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db, RECURRING_COLUMNS, TX_COLUMNS } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { sendToUser } from "@/lib/push";
import { dueReminders, reminderNotification } from "@/lib/reminders";
import type { RecurringRow, TransactionRow } from "@/lib/types";

// Vercel Cron her sabah çağırır (vercel.json). Bildirim aboneliği olan her kullanıcı için
// hatırlatma penceresine giren ödemeleri toplar ve tek bildirim gönderir.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CRON_SECRET tanımlıysa zorunlu tutulur. Tanımlı değilse de uç nokta güvenlidir:
 * aynı ödeme için ikinci bildirim gönderilmez (reminders_sent) ve çağrılar 10 dakikada
 * bire sınırlandırılır (aşağıdaki kilit).
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

type UserRow = { user_id: string; timezone: string; currency: string };

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const sql = db();
  const claimed = await sql`insert into app_settings (key, value) values ('cron_last_run', now()::text)
    on conflict (key) do update set value = excluded.value, updated_at = now()
      where app_settings.updated_at < now() - interval '10 minutes'
    returning key`;
  if (claimed.length === 0) return NextResponse.json({ skipped: "yakın zamanda çalıştı" });

  const users = (await sql`
    select distinct s.user_id,
           coalesce(p.timezone, 'Europe/Istanbul') as timezone,
           coalesce(p.currency, 'TRY') as currency
      from push_subscriptions s left join profiles p on p.user_id = s.user_id`) as UserRow[];

  let notified = 0;
  for (const u of users) {
    try {
      const today = todayIn(u.timezone);
      const [recurring, transactions, categories, sent] = await Promise.all([
        sql`select ${sql.unsafe(RECURRING_COLUMNS)} from recurring
             where user_id = ${u.user_id} and active and kind = 'expense' and remind_days is not null`,
        sql`select ${sql.unsafe(TX_COLUMNS)} from transactions
             where user_id = ${u.user_id} and kind = 'expense' and remind_days is not null
               and occurred_on between ${today}::date and ${today}::date + 31`,
        sql`select id, name from categories where user_id = ${u.user_id}`,
        sql`select source_id::text as source_id, due_on::text as due_on from reminders_sent
             where user_id = ${u.user_id} and due_on >= ${today}::date`,
      ]);

      const already = new Set((sent as { source_id: string; due_on: string }[]).map((s) => `${s.source_id}|${s.due_on}`));
      const items = dueReminders(recurring as RecurringRow[], transactions as TransactionRow[], today).filter(
        (r) => !already.has(`${r.sourceId}|${r.due}`),
      );
      if (items.length === 0) continue;

      const names = new Map((categories as { id: string; name: string }[]).map((c) => [c.id, c.name]));
      const { title, body } = reminderNotification(items, (id) => names.get(id), u.currency);
      const delivered = await sendToUser(u.user_id, { title, body, url: "/", tag: `hatirlatma-${today}` });

      if (delivered > 0) {
        notified++;
        await sql.transaction(
          items.map(
            (r) => sql`insert into reminders_sent (source_id, due_on, user_id)
                       values (${r.sourceId}, ${r.due}, ${u.user_id}) on conflict do nothing`,
          ),
        );
      }
    } catch (e) {
      console.error("[cron] hatırlatma", u.user_id, e);
    }
  }

  await sql`delete from reminders_sent where due_on < current_date - 60`;
  return NextResponse.json({ users: users.length, notified });
}
