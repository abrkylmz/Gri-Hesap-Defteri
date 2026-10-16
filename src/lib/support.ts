import "server-only";
import { db } from "@/lib/db";

// Canlı destek okumaları. Kullanıcı yalnızca kendi sohbetini, destek ekibi (yönetici + moderatör)
// tüm sohbetleri görür; yetki kontrolü çağıran yerde (sayfa / route / action) yapılır.

export type SupportMessage = {
  id: string;
  fromStaff: boolean;
  /** Yanıtlayan ekip üyesinin adı (yalnızca ekip görünümünde dolu) */
  sender: string | null;
  body: string;
  createdMs: number;
};

export type SupportThread = {
  id: string;
  userId: string;
  username: string;
  status: "open" | "closed";
  lastMessageMs: number;
  lastFromStaff: boolean;
  /** Ekip henüz okumadı (kullanıcıdan yeni mesaj var) */
  unread: boolean;
  preview: string;
};

const MESSAGE_LIMIT = 300;

/** Bir sohbetin son mesajları, eskiden yeniye. `withSender`: yanıtlayanın adı (yalnızca ekip için). */
export async function threadMessages(threadId: string, withSender: boolean): Promise<SupportMessage[]> {
  const rows = (await db()`
    select * from (
      select m.id::text as id, m.from_staff as "fromStaff",
             case when ${withSender} then u.username end as sender,
             m.body, (extract(epoch from m.created_at) * 1000)::float8 as "createdMs"
        from support_messages m left join users u on u.id = m.sender_id
       where m.thread_id = ${threadId}
       order by m.created_at desc
       limit ${MESSAGE_LIMIT}
    ) x order by "createdMs"`) as SupportMessage[];
  return rows;
}

/** Kullanıcının kendi sohbeti (yoksa null) ve mesajları. */
export async function getOwnThread(userId: string) {
  const [t] = (await db()`select id::text as id, status from support_threads where user_id = ${userId}`) as {
    id: string;
    status: "open" | "closed";
  }[];
  if (!t) return { thread: null, messages: [] as SupportMessage[] };
  return { thread: t, messages: await threadMessages(t.id, false) };
}

/** Destek kutusu: tüm sohbetler, en yeni mesaj üstte. */
export async function getInbox(): Promise<SupportThread[]> {
  return (await db()`
    select t.id::text as id, t.user_id::text as "userId", u.username, t.status,
           (extract(epoch from t.last_message_at) * 1000)::float8 as "lastMessageMs",
           t.last_from_staff as "lastFromStaff",
           (not t.last_from_staff and (t.staff_read_at is null or t.staff_read_at < t.last_message_at)) as unread,
           coalesce(left(lm.body, 120), '') as preview
      from support_threads t
      join users u on u.id = t.user_id
      left join lateral (
        select body from support_messages where thread_id = t.id order by created_at desc limit 1
      ) lm on true
     order by (t.status = 'open') desc, t.last_message_at desc
     limit 200`) as SupportThread[];
}

/** Ekip için tek sohbetin başlık bilgisi. */
export async function getThreadInfo(threadId: string) {
  const [t] = (await db()`
    select t.id::text as id, u.username, t.status,
           (extract(epoch from u.created_at) * 1000)::float8 as "userSinceMs"
      from support_threads t join users u on u.id = t.user_id
     where t.id = ${threadId}`) as { id: string; username: string; status: "open" | "closed"; userSinceMs: number }[];
  return t ?? null;
}

/** Okunmamış sayısı: kullanıcı için ekipten gelen yeni yanıt (0/1), ekip için bekleyen sohbet sayısı. */
export async function supportBadge(userId: string, staff: boolean): Promise<{ own: number; inbox: number }> {
  const sql = db();
  const [own, inbox] = await Promise.all([
    sql`select count(*)::int as n from support_threads
         where user_id = ${userId} and last_from_staff
           and (user_read_at is null or user_read_at < last_message_at)`,
    staff
      ? sql`select count(*)::int as n from support_threads
             where status = 'open' and not last_from_staff
               and (staff_read_at is null or staff_read_at < last_message_at)`
      : Promise.resolve([{ n: 0 }]),
  ]);
  return { own: (own[0] as { n: number }).n, inbox: (inbox[0] as { n: number }).n };
}

export type SupportSnippet = { id: string; title: string; body: string };

/** Ekibin ortak hazır yanıtları (alfabetik). */
export async function getSnippets(): Promise<SupportSnippet[]> {
  return (await db()`select id::text as id, title, body from support_snippets order by title limit 100`) as SupportSnippet[];
}
