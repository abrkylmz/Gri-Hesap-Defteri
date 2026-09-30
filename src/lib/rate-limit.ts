import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

/** Sınır tanımları: pencere (saniye) içinde en fazla `limit` istek. */
export const LIMITS = {
  /** Aynı IP'den giriş denemesi (kullanıcı adı başına ayrıca 15 dk'da 10 hatalı deneme sınırı var) */
  loginIp: { window: 15 * 60, limit: 30 },
  /** Aynı IP'den yeni hesap */
  signupIp: { window: 60 * 60, limit: 5 },
  /** Tüm sitede yeni hesap (dağıtık bot saldırısına karşı) */
  signupGlobal: { window: 24 * 60 * 60, limit: 200 },
  /** Şifre değiştirirken mevcut şifre tahmini */
  passwordChange: { window: 15 * 60, limit: 10 },
  /** Davet (kullanıcı adı taramasına karşı) */
  invite: { window: 60 * 60, limit: 20 },
  /** Toplu içe aktarma */
  import: { window: 60 * 60, limit: 20 },
  /** CSV dışa aktarma */
  export: { window: 60 * 60, limit: 30 },
  /** Bildirim aboneliği */
  push: { window: 60 * 60, limit: 20 },
  /** Genel yazma işlemleri (kayıt ekleme, düzenleme, silme…) */
  write: { window: 5 * 60, limit: 300 },
  /** Yönetici işlemleri */
  admin: { window: 15 * 60, limit: 60 },
} as const satisfies Record<string, { window: number; limit: number }>;

export type LimitName = keyof typeof LIMITS;

export const RATE_LIMITED = "Çok fazla istek gönderildi. Biraz bekleyip tekrar dene.";

/**
 * İsteği sayar; sınır aşıldıysa false döner. `subject` sınırın kime uygulandığıdır
 * (IP, kullanıcı id'si ya da "all"). Sayaca ulaşılamazsa işlem engellenmez: veritabanı
 * sorunu kullanıcıyı kilitlemesin (asıl yetki kontrolleri zaten ayrıca yapılır).
 */
export async function allow(name: LimitName, subject: string): Promise<boolean> {
  const { window, limit } = LIMITS[name];
  try {
    const [row] = (await db()`select rate_hit(${`${name}:${subject}`.slice(0, 200)}, ${window}, ${limit}) as ok`) as {
      ok: boolean;
    }[];
    return row?.ok !== false;
  } catch (e) {
    console.error("[rate-limit]", name, e);
    return true;
  }
}

/**
 * İstemcinin IP adresi. Vercel bu başlıkları kendisi yazar (istemcinin gönderdiği değerin
 * üzerine), bu yüzden taklit edilemez. Yerelde bilinmiyorsa "unknown".
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip && ip.length <= 64 ? ip : "unknown";
}
