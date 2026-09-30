import "server-only";
import webpush, { WebPushError } from "web-push";
import { isPushEndpoint } from "@/lib/push-endpoint";
import { db } from "@/lib/db";

export type PushPayload = { title: string; body: string; url?: string; tag?: string; /** Uygulama simgesi rozeti */ badge?: number };
type VapidKeys = { publicKey: string; privateKey: string };

let keysPromise: Promise<VapidKeys> | null = null;

/**
 * VAPID anahtarları: ortam değişkeni varsa o, yoksa veritabanında saklanan çift.
 * İlk ihtiyaçta üretilir; eşzamanlı ilk isteklerde de tek çift oluşur (on conflict do nothing).
 */
async function loadKeys(): Promise<VapidKeys> {
  const envPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;
  if (envPublic && envPrivate) return { publicKey: envPublic, privateKey: envPrivate };

  const sql = db();
  const read = async () => {
    const rows = (await sql`select key, value from app_settings
      where key in ('vapid_public', 'vapid_private')`) as { key: string; value: string }[];
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const publicKey = map.get("vapid_public");
    const privateKey = map.get("vapid_private");
    return publicKey && privateKey ? { publicKey, privateKey } : null;
  };

  const existing = await read();
  if (existing) return existing;

  const fresh = webpush.generateVAPIDKeys();
  await sql.transaction([
    sql`insert into app_settings (key, value) values ('vapid_public', ${fresh.publicKey}) on conflict do nothing`,
    sql`insert into app_settings (key, value) values ('vapid_private', ${fresh.privateKey}) on conflict do nothing`,
  ]);
  const stored = await read();
  if (!stored) throw new Error("VAPID anahtarları kaydedilemedi");
  return stored;
}

async function keys(): Promise<VapidKeys> {
  keysPromise ??= loadKeys().catch((e) => {
    keysPromise = null; // bir sonraki istekte yeniden dene
    throw e;
  });
  return keysPromise;
}

/** Tarayıcının abone olurken kullanacağı genel anahtar. */
export async function vapidPublicKey(): Promise<string | null> {
  try {
    return (await keys()).publicKey;
  } catch (e) {
    console.error("[push] anahtar", e);
    return null;
  }
}

let configured = false;
async function ensureConfigured() {
  if (configured) return;
  const { publicKey, privateKey } = await keys();
  // Apple'ın push servisi geçerli bir https/mailto "subject" ister.
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? site ?? "https://gri.local", publicKey, privateKey);
  configured = true;
}

type Subscription = { endpoint: string; p256dh: string; auth: string };

/**
 * Kullanıcının tüm cihazlarına bildirim gönderir. Süresi dolmuş abonelikleri (404/410) temizler.
 * Başarılı gönderim sayısını döndürür.
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  await ensureConfigured();
  const sql = db();
  const all = (await sql`select endpoint, p256dh, auth from push_subscriptions
    where user_id = ${userId}`) as Subscription[];
  // Bilinen push servisleri dışındaki (eski ya da kötü niyetli) adreslere istek atılmaz, silinir.
  const subs = all.filter((s) => isPushEndpoint(s.endpoint));
  const invalid = all.filter((s) => !isPushEndpoint(s.endpoint)).map((s) => s.endpoint);
  if (invalid.length) await sql`delete from push_subscriptions where endpoint = any(${invalid})`;

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
