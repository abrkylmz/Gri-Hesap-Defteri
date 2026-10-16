"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/config";
import { db } from "@/lib/db";
import { fail, OK, type ActionResult } from "@/lib/action-utils";
import { hashToken, verifyPassword } from "@/lib/password";
import { allow, RATE_LIMITED } from "@/lib/rate-limit";

const SESSION_EXPIRED = fail("Oturumunun süresi dolmuş. Lütfen yeniden giriş yap.");
const SESSION_ID = /^[0-9a-f]{16}$/;

async function currentTokenHash() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

/** Tek bir oturumu (cihazı) kapatır. Kimlik: oturum özetinin ilk 16 karakteri. */
export async function revokeSession(id: string): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return SESSION_EXPIRED;
  if (!SESSION_ID.test(id)) return fail("Oturum bulunamadı.");
  if (!(await allow("write", user.userId))) return fail(RATE_LIMITED);
  const mine = await currentTokenHash();
  if (mine?.startsWith(id)) return fail("Bu cihazdaki oturumu kapatmak için Çıkış yap'ı kullan.");
  const rows =
    await db()`delete from sessions where user_id = ${user.userId} and left(token_hash, 16) = ${id} returning 1`;
  if (rows.length === 0) return fail("Oturum bulunamadı.");
  revalidatePath("/ayarlar");
  return OK;
}

/** Bu cihaz dışındaki tüm oturumları kapatır. */
export async function revokeOtherSessions(): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return SESSION_EXPIRED;
  if (!(await allow("write", user.userId))) return fail(RATE_LIMITED);
  const mine = await currentTokenHash();
  await db()`delete from sessions where user_id = ${user.userId} and token_hash <> ${mine ?? ""}`;
  revalidatePath("/ayarlar");
  return OK;
}

/**
 * Hesabı ve tüm verilerini kalıcı olarak siler (şifre onayıyla). Son yönetici kendini silemez
 * (uygulama yöneticisiz kalmasın).
 */
export async function deleteOwnAccount(password: string, confirmText: string): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return SESSION_EXPIRED;
  if (confirmText.trim().toLocaleUpperCase("tr") !== "SİL") return fail("Onay için kutuya SİL yaz.");
  if (password.length > 256) return fail("Şifre hatalı.");
  if (!(await allow("passwordChange", user.userId))) return fail(RATE_LIMITED);
  const sql = db();
  try {
    const [row] = (await sql`select password_hash, role,
        (select count(*)::int from users where role = 'admin' and disabled_at is null) as admins
      from users where id = ${user.userId}`) as { password_hash: string; role: string; admins: number }[];
    if (!row || !(await verifyPassword(password, row.password_hash))) return fail("Şifre hatalı.");
    if (row.role === "admin" && row.admins <= 1) {
      return fail("Uygulamanın tek yöneticisisin. Önce başka bir kullanıcıyı yönetici yap.");
    }
    await sql`select delete_user(${user.userId}::uuid)`;
  } catch (e) {
    console.error("[account] silme", e);
    return fail("Hesap silinemedi. Tekrar dene.");
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/giris?silindi=1");
}
