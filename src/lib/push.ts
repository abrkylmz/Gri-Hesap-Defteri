import webpush, { WebPushError } from "web-push";
import { db } from "@/lib/db";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let configured: boolean | null = null;

/** VAPID anahtarları tanımlıysa web-push'u yapılandırır. */
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return (configured = false);
  // Apple'ın push servisi geçerli bir https/mailto "subject" ister.
  const site = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? site ?? "https://gri.local", publicKey, privateKey);
  return (configured = true);
}

type Subscription = { endpoint: string; p256dh: string; auth: string };

/**
 * Kullanıcının tüm cihazlarına bildirim gönderir. Süresi dolmuş abonelikleri (404/410) temizler.
 * Başarılı gönderim sayısını döndürür.
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  const sql = db();
  const subs = (await sql`select endpoint, p256dh, auth from push_subscriptions
    where user_id = ${userId}`) as Subscription[];

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 12, urgency: "normal" },
      ),
    ),
  );

  let delivered = 0;
  const gone: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") delivered++;
    else if (r.reason instanceof WebPushError && [404, 410].includes(r.reason.statusCode)) {
      gone.push(subs[i]!.endpoint);
    } else {
      console.error("[push] gönderilemedi", r.reason);
    }
  });
  if (gone.length) await sql`delete from push_subscriptions where endpoint = any(${gone})`;
  return delivered;
}
