import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/config";
import { hashToken, newSessionToken } from "@/lib/password";

const SESSION_DAYS = 180;

export type Role = "admin" | "user";
export type SessionUser = { userId: string; username: string; role: Role };

/** Oturumdaki kullanıcı; yoksa ya da süresi dolmuşsa null. İstek başına bir kez çalışır. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sql = db();
  // Devre dışı bırakılmış hesapların oturumları anında geçersiz sayılır.
  const rows = (await sql`
    select u.id::text as "userId", u.username, u.role
      from sessions s join users u on u.id = s.user_id
     where s.token_hash = ${hashToken(token)} and s.expires_at > now() and u.disabled_at is null`) as SessionUser[];
  const user = rows[0] ?? null;
  if (user) {
    // "Son görülme": yanıt gönderildikten sonra, en fazla saatte bir yazılır.
    after(async () => {
      try {
        await sql`update users set last_seen_at = now()
          where id = ${user.userId} and (last_seen_at is null or last_seen_at < now() - interval '1 hour')`;
      } catch (e) {
        console.error("[auth] last_seen", e);
      }
    });
  }
  return user;
});

/** Yönetici değilse 404 döner (panelin varlığını da ele vermez). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") notFound();
  return user;
}

/** Oturum yoksa giriş sayfasına yönlendirir. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/giris");
  return user;
}

/** Yeni oturum açar ve çerezi yazar (yalnızca Server Action / Route Handler içinden). */
export async function startSession(userId: string) {
  const token = newSessionToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const sql = db();
  await sql.transaction([
    sql`insert into sessions (token_hash, user_id, expires_at)
        values (${hashToken(token)}, ${userId}, ${expires.toISOString()})`,
    // Süresi dolmuş oturumları fırsat buldukça temizle.
    sql`delete from sessions where user_id = ${userId} and expires_at < now()`,
  ]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db()`delete from sessions where token_hash = ${hashToken(token)}`;
  store.delete(SESSION_COOKIE);
}
