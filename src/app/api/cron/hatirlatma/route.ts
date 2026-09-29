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

type LedgerRow = { owner_id: string; username: string; timezone: string; currency: string };

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const sql = db();
  const claimed = await sql`insert into app_settings (key, value) values ('cron_last_run', now()::text)
    on conflict (key) do update set value = excluded.value, updated_at = now()
      where app_settings.updated_at < now() - interval '10 minutes'
    returning key`;
  if (claimed.length === 0) return NextResponse.json({ skipped: "yakın zamanda çalıştı" });

  // Bildirim alabilecek biri (sahibi ya da kabul etmiş bir üyesi) olan her defter.
  const ledgers = (await sql`
    select o.owner_id, u.username,
           coalesce(p.timezone, 'Europe/Istanbul') as timezone,
           coalesce(p.currency, 'TRY') as currency
      from (
        select user_id as owner_id from push_subscriptions
        union
        select m.owner_id from ledger_members m
          join push_subscriptions s on s.user_id = m.member_id
         where m.status = 'accepted'
      ) o
      join users u on u.id::text = o.owner_id and u.disabled_at is null
      left join profiles p on p.user_id = o.owner_id`) as LedgerRow[];

  let notified = 0;
  for (const l of ledgers) {
    try {
      const today = todayIn(l.timezone);
      const [recurring, transactions, categories, sent, members, runs] = await Promise.all([
        sql`select ${sql.unsafe(RECURRING_COLUMNS)} from recurring
             where user_id = ${l.owner_id} and active and kind = 'expense' and remind_days is not null`,
        sql`select ${sql.unsafe(TX_COLUMNS)} from transactions
             where user_id = ${l.owner_id} and kind = 'expense' and remind_days is not null and paid_at is null
               and occurred_on between ${today}::date and ${today}::date + 31`,
        sql`select id, name from categories where user_id = ${l.owner_id}`,
        sql`select source_id::text as source_id, due_on::text as due_on from reminders_sent
             where user_id = ${l.owner_id} and due_on >= ${today}::date`,
        sql`select member_id from ledger_members where owner_id = ${l.owner_id} and status = 'accepted'`,
        sql`select rr.recurring_id::text || '|' || to_char(rr.period, 'YYYY-MM') as key
               from recurring_runs rr join recurring r on r.id = rr.recurring_id
              where r.user_id = ${l.owner_id} and rr.period >= date_trunc('month', ${today}::date)`,
      ]);

      const already = new Set((sent as { source_id: string; due_on: string }[]).map((s) => `${s.source_id}|${s.due_on}`));
      const doneRuns = new Set((runs as { key: string }[]).map((r) => r.key));
      const items = dueReminders(recurring as RecurringRow[], transactions as TransactionRow[], today, doneRuns).filter(
        (r) => !already.has(`${r.sourceId}|${r.due}`),
      );
      if (items.length === 0) continue;

      const names = new Map((categories as { id: string; name: string }[]).map((c) => [c.id, c.name]));
      const { title, body } = reminderNotification(items, (id) => names.get(id), l.currency);
      const tag = `hatirlatma-${l.owner_id}-${today}`;

      // Sahibe olduğu gibi; üyelere hangi defter olduğu belirtilerek.
      const badge = items.length;
      let delivered = await sendToUser(l.owner_id, { title, body, url: "/", tag, badge });
      for (const m of members as { member_id: string }[]) {
        delivered += await sendToUser(m.member_id, { title: `${l.username} defteri · ${title}`, body, url: "/", tag, badge });
      }

      if (delivered > 0) {
        notified++;
        await sql.transaction(
          items.map(
            (r) => sql`insert into reminders_sent (source_id, due_on, user_id)
                       values (${r.sourceId}, ${r.due}, ${l.owner_id}) on conflict do nothing`,
          ),
        );
      }
    } catch (e) {
      console.error("[cron] hatırlatma", l.owner_id, e);
    }
  }

  await sql`delete from reminders_sent where due_on < current_date - 60`;
  return NextResponse.json({ ledgers: ledgers.length, notified });
}
