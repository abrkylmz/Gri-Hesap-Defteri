"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser, isSupportStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, OK, type ActionResult } from "@/lib/action-utils";
import { sendToUser } from "@/lib/push";
import { allow, RATE_LIMITED } from "@/lib/rate-limit";

const bodySchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, "Mesaj boş olamaz.").max(2000, "Mesaj en fazla 2000 karakter olabilir."));
const idSchema = z.uuid();

const SESSION_EXPIRED = "Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.";
const CONNECTION = "Mesaj gönderilemedi. Tekrar dene.";

/** Kullanıcı: destek ekibine mesaj yazar (sohbet yoksa açılır, kapalıysa yeniden açılır). */
export async function sendSupportMessage(input: string): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return fail(SESSION_EXPIRED);
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Mesaj geçersiz.");
  if (!(await allow("support", user.userId))) return fail(RATE_LIMITED);

  const sql = db();
  let notifyStaff = false;
  try {
    // Ekip yalnızca "sessiz" bir sohbete yeni mesaj gelince bildirilir (art arda mesajlarda tekrar tekrar değil).
    const [prev] = (await sql`select last_from_staff, status, last_message_at < now() - interval '15 minutes' as stale
                                from support_threads where user_id = ${user.userId}`) as {
      last_from_staff: boolean;
      status: string;
      stale: boolean;
    }[];
    notifyStaff = !prev || prev.last_from_staff || prev.status === "closed" || prev.stale;
    const [t] = (await sql`
      insert into support_threads (user_id, status, last_message_at, last_from_staff, user_read_at)
      values (${user.userId}, 'open', now(), false, now())
      on conflict (user_id) do update
        set status = 'open', last_message_at = now(), last_from_staff = false, user_read_at = now()
      returning id`) as { id: string }[];
    await sql`insert into support_messages (thread_id, sender_id, from_staff, body)
              values (${t!.id}, ${user.userId}, false, ${parsed.data})`;
  } catch (e) {
    console.error("[support] mesaj", e);
    return fail(CONNECTION);
  }

  if (notifyStaff) {
    after(async () => {
      try {
        const staff = (await sql`select id::text as id from users
          where (role = 'admin' or support_agent) and disabled_at is null and id <> ${user.userId}`) as {
          id: string;
        }[];
        await Promise.all(
          staff.map((s) =>
            sendToUser(s.id, {
              title: `Destek: ${user.username}`,
              body: parsed.data.slice(0, 140),
              url: "/destek/gelen",
              tag: "destek-gelen",
            }),
          ),
        );
      } catch (e) {
        console.error("[support] ekip bildirimi", e);
      }
    });
  }
  revalidatePath("/destek", "layout");
  return OK;
}

async function staffGuard(threadId: string) {
  const user = await currentUser();
  if (!user) return { error: fail(SESSION_EXPIRED) };
  if (!isSupportStaff(user)) return { error: fail("Bu işlem için yetkin yok.") };
  if (!idSchema.safeParse(threadId).success) return { error: fail("Sohbet bulunamadı.") };
  return { user };
}

/** Ekip: bir sohbete yanıt yazar; kullanıcıya bildirim gider. */
export async function replySupport(threadId: string, input: string): Promise<ActionResult> {
  const g = await staffGuard(threadId);
  if (g.error) return g.error;
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Mesaj geçersiz.");
  if (!(await allow("support", g.user.userId))) return fail(RATE_LIMITED);

  const sql = db();
  let ownerId: string;
  try {
    const [t] = (await sql`update support_threads
        set status = 'open', last_message_at = now(), last_from_staff = true, staff_read_at = now()
      where id = ${threadId} returning user_id::text as owner`) as { owner: string }[];
    if (!t) return fail("Sohbet bulunamadı.");
    ownerId = t.owner;
    await sql`insert into support_messages (thread_id, sender_id, from_staff, body)
              values (${threadId}, ${g.user.userId}, true, ${parsed.data})`;
  } catch (e) {
    console.error("[support] yanıt", e);
    return fail(CONNECTION);
  }

  after(async () => {
    try {
      await sendToUser(ownerId, {
        title: "Destek ekibinden yanıt",
        body: parsed.data.slice(0, 140),
        url: "/destek",
        tag: "destek",
      });
    } catch (e) {
      console.error("[support] kullanıcı bildirimi", e);
    }
  });
  revalidatePath("/destek", "layout");
  return OK;
}

/** Ekip: sohbeti çözüldü olarak kapatır ya da yeniden açar. */
export async function setSupportStatus(threadId: string, status: "open" | "closed"): Promise<ActionResult> {
  const g = await staffGuard(threadId);
  if (g.error) return g.error;
  const safe = status === "closed" ? "closed" : "open";
  try {
    const rows = await db()`update support_threads set status = ${safe}, staff_read_at = now()
      where id = ${threadId} returning id`;
    if (rows.length === 0) return fail("Sohbet bulunamadı.");
  } catch (e) {
    console.error("[support] durum", e);
    return fail("Kaydedilemedi. Tekrar dene.");
  }
  revalidatePath("/destek", "layout");
  return OK;
}
