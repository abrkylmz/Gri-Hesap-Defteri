"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, OK, type ActionResult } from "@/lib/action-utils";
import { hashPassword } from "@/lib/password";
import { allow, RATE_LIMITED } from "@/lib/rate-limit";
import { sendToUser } from "@/lib/push";

const idSchema = z.uuid();

/**
 * Her yönetim işlemi yetkiyi veritabanından yeniden doğrular ve yöneticinin
 * kendi hesabı üzerinde yıkıcı işlem yapmasını engeller (kendini kilitlememek için).
 */
async function guard(targetId?: string): Promise<{ adminId: string } | ActionResult> {
  const user = await currentUser();
  if (!user || user.role !== "admin") return fail("Bu işlem için yetkin yok.");
  if (!(await allow("admin", user.userId))) return fail(RATE_LIMITED);
  if (targetId !== undefined) {
    if (!idSchema.safeParse(targetId).success) return fail("Kullanıcı bulunamadı.");
    if (targetId === user.userId) return fail("Bu işlemi kendi hesabında yapamazsın.");
  }
  return { adminId: user.userId };
}

const isFailure = (r: { adminId: string } | ActionResult): r is ActionResult => !("adminId" in r);

function done(): ActionResult {
  revalidatePath("/yonetim");
  return OK;
}

async function run(targetId: string | undefined, work: () => Promise<unknown[] | void>) {
  const g = await guard(targetId);
  if (isFailure(g)) return g;
  try {
    const rows = await work();
    if (Array.isArray(rows) && rows.length === 0) return fail("Kullanıcı bulunamadı.");
  } catch (e) {
    console.error("[admin]", e);
    return fail("Bir şeyler ters gitti. Lütfen tekrar dene.");
  }
  return done();
}

export async function setSignupOpen(open: boolean): Promise<ActionResult> {
  return run(undefined, async () => {
    await db()`insert into app_settings (key, value) values ('signup_open', ${open ? "true" : "false"})
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
  });
}

export async function setUserDisabled(id: string, disabled: boolean): Promise<ActionResult> {
  const sql = db();
  return run(id, async () => {
    const rows = await sql`update users set disabled_at = ${disabled ? new Date().toISOString() : null}
      where id = ${id} returning id`;
    // Devre dışı bırakılan hesabın açık oturumları hemen kapanır.
    if (disabled) await sql`delete from sessions where user_id = ${id}`;
    return rows;
  });
}

export async function setUserRole(id: string, role: "admin" | "user"): Promise<ActionResult> {
  const safeRole = role === "admin" ? "admin" : "user";
  return run(id, () => db()`update users set role = ${safeRole} where id = ${id} returning id`);
}

/** Destek moderatörü: destek kutusunu görür ve yanıtlar (yönetim paneline erişmez). */
export async function setSupportAgent(id: string, on: boolean): Promise<ActionResult> {
  return run(id, () => db()`update users set support_agent = ${on === true} where id = ${id} returning id`);
}

export async function deleteUser(id: string): Promise<ActionResult> {
  return run(id, async () => {
    const sql = db();
    const exists = await sql`select 1 from users where id = ${id}`;
    if (exists.length === 0) return [];
    await sql`select delete_user(${id})`;
  });
}

// Karışmaya açık karakterler (0/O, 1/l/I) çıkarıldı: sözlü ya da yazılı iletmesi kolay.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Geçici şifre üretir, hesabın tüm oturumlarını kapatır ve şifreyi yöneticiye BİR KEZ döndürür. */
export async function resetUserPassword(
  id: string,
): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const g = await guard(id);
  if (isFailure(g)) return g as { ok: false; error: string };

  const password = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""),
  ).join("-");
  try {
    const sql = db();
    const rows = await sql`update users set password_hash = ${await hashPassword(password)}
      where id = ${id} returning username`;
    if (rows.length === 0) return { ok: false, error: "Kullanıcı bulunamadı." };
    await sql`delete from sessions where user_id = ${id}`;
    await sql`delete from login_failures where username = ${(rows[0] as { username: string }).username}`;
  } catch (e) {
    console.error("[admin] şifre sıfırlama", e);
    return { ok: false, error: "Şifre sıfırlanamadı." };
  }
  revalidatePath("/yonetim");
  return { ok: true, password };
}

/** Son hatalar listesini temizler. */
export async function clearErrors(): Promise<ActionResult> {
  return run(undefined, async () => {
    await db()`delete from app_errors`;
  });
}

const announcementInput = z.object({
  title: z.string().trim().min(1, "Başlık yaz.").max(80, "Başlık en fazla 80 karakter."),
  body: z.string().trim().min(1, "Mesajı yaz.").max(500, "Mesaj en fazla 500 karakter."),
  audience: z.enum(["all", "active"]),
});

/**
 * Duyuru: uygulamada (ana ekranda kapatılabilir şerit) gösterilir ve bildirim aboneliği olan
 * kullanıcılara telefon bildirimi olarak gönderilir. "active": son 30 günde giriş yapanlar.
 */
export async function sendAnnouncement(
  input: unknown,
): Promise<{ ok: true; audience: number; delivered: number } | { ok: false; error: string }> {
  const g = await guard();
  if (isFailure(g)) return g as { ok: false; error: string };
  const parsed = announcementInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz duyuru." };
  const { title, body, audience } = parsed.data;
  const sql = db();
  try {
    const users = (await sql`select id::text as id from users
      where disabled_at is null
        and (${audience} = 'all' or last_seen_at > now() - interval '30 days')`) as { id: string }[];
    let delivered = 0;
    // Küçük gruplar halinde (bildirim servisine aynı anda çok istek gitmesin)
    for (let i = 0; i < users.length; i += 20) {
      const batch = await Promise.all(
        users.slice(i, i + 20).map((u) => sendToUser(u.id, { title, body, url: "/", tag: "duyuru" }).catch(() => 0)),
      );
      delivered += batch.reduce((s, n) => s + n, 0);
    }
    await sql`insert into announcements (title, body, created_by, audience, delivered)
              values (${title}, ${body}, ${g.adminId}, ${users.length}, ${delivered})`;
    revalidatePath("/", "layout");
    return { ok: true, audience: users.length, delivered };
  } catch (e) {
    console.error("[admin] duyuru", e);
    return { ok: false, error: "Duyuru gönderilemedi." };
  }
}
