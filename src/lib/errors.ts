import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

// Uygulama hataları: yönetim panelindeki "Son hatalar" için. Aynı hata (kaynak + mesaj + sayfa) tek satırda
// sayılır. Gizlilik: adresin sorgu kısmı atılır, mesaj kısaltılır; kullanıcı kimliği yazılmaz.

export type AppError = {
  id: string;
  source: "server" | "client";
  message: string;
  path: string | null;
  digest: string | null;
  count: number;
  firstMs: number;
  lastMs: number;
};

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
/** "/odemeler?x=1" → "/odemeler"; uuid'ler ":id" ile değiştirilir (aynı sayfa tek satır olsun). */
export const cleanPath = (p: string | null | undefined) =>
  p
    ? clean(p.split(/[?#]/)[0]!.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id"), 200)
    : null;

export async function recordError(e: { source: "server" | "client"; message: string; path?: string | null; digest?: string | null }) {
  try {
    const message = clean(e.message || "Bilinmeyen hata", 500);
    const path = cleanPath(e.path);
    const digest = e.digest ? clean(e.digest, 64) : null;
    const fingerprint = createHash("sha256").update(`${e.source}|${message}|${path ?? ""}`).digest("hex").slice(0, 32);
    await db()`insert into app_errors (fingerprint, source, message, path, digest)
               values (${fingerprint}, ${e.source}, ${message}, ${path}, ${digest})
               on conflict (fingerprint) do update
                 set count = app_errors.count + 1, last_at = now(), digest = coalesce(excluded.digest, app_errors.digest)`;
  } catch (err) {
    // Hata kaydı başarısız olursa uygulamayı etkilemesin.
    console.error("[errors] kaydedilemedi", err);
  }
}

export async function recentErrors(limit = 30): Promise<AppError[]> {
  return (await db()`
    select id::text as id, source, message, path, digest, count,
           (extract(epoch from first_at) * 1000)::float8 as "firstMs",
           (extract(epoch from last_at) * 1000)::float8 as "lastMs"
      from app_errors order by last_at desc limit ${limit}`) as AppError[];
}
