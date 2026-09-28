"use server";

import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, OK, type ActionResult } from "@/lib/action-utils";
import { sendToUser } from "@/lib/push";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2048).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
});

const SESSION_EXPIRED = fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");

export async function savePushSubscription(input: unknown): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return fail("Bu tarayıcı bildirim aboneliği oluşturamadı.");
  const { endpoint, keys } = parsed.data;
  try {
    // Aynı cihaz başka hesaba geçtiyse abonelik yeni hesaba taşınır.
    await db()`insert into push_subscriptions (endpoint, user_id, p256dh, auth)
      values (${endpoint}, ${user.userId}, ${keys.p256dh}, ${keys.auth})
      on conflict (endpoint) do update
        set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`;
  } catch (e) {
    console.error("[push] kayıt", e);
    return fail("Bildirim aboneliği kaydedilemedi.");
  }
  return OK;
}

export async function deletePushSubscription(endpoint: string): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return SESSION_EXPIRED;
  try {
    await db()`delete from push_subscriptions where endpoint = ${endpoint} and user_id = ${user.userId}`;
  } catch (e) {
    console.error("[push] silme", e);
    return fail("Abonelik kaldırılamadı.");
  }
  return OK;
}

export async function sendTestPush(): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return SESSION_EXPIRED;
  let delivered = 0;
  try {
    delivered = await sendToUser(user.userId, {
      title: "Gri · test bildirimi",
      body: "Bildirimler çalışıyor. Yaklaşan ödemelerini sabah 09:00'da hatırlatacağım.",
      url: "/",
      tag: "test",
    });
  } catch (e) {
    console.error("[push] test", e);
  }
  return delivered > 0 ? OK : fail("Bildirim gönderilemedi. Bildirimleri kapatıp yeniden açmayı dene.");
}
