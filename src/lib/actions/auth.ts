"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser, endSession, startSession } from "@/lib/auth";
import { db, isDbError } from "@/lib/db";
import {
  DUMMY_HASH,
  hashPassword,
  MIN_PASSWORD,
  normalizeUsername,
  USERNAME_RE,
  verifyPassword,
} from "@/lib/password";
import { allow, clientIp, RATE_LIMITED } from "@/lib/rate-limit";

export type AuthState = { error?: string; message?: string; username?: string } | null;

const MAX_FAILURES = 10;
const FAILURE_WINDOW = "15 minutes";
const GENERIC = "Bir şeyler ters gitti. Lütfen tekrar dene.";
const USERNAME_HINT = "Kullanıcı adı 3-32 karakter olmalı; yalnızca küçük harf, rakam, nokta, tire ve alt çizgi.";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "");

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const username = normalizeUsername(text(fd, "username"));
  const password = text(fd, "password");
  if (!username || !password) return { error: "Kullanıcı adı ve şifreni gir.", username };
  // Aşırı uzun girdiyle şifre özetleme maliyetini şişirmeye izin verme.
  if (username.length > 64 || password.length > 256) return { error: "Kullanıcı adı veya şifre hatalı.", username };

  const sql = db();
  try {
    // Aynı IP'den çok sayıda kullanıcı adına deneme (parola püskürtme) sınırı.
    if (!(await allow("loginIp", await clientIp()))) return { error: RATE_LIMITED, username };
    const [recent] = (await sql`select count(*)::int as n from login_failures
      where username = ${username} and at > now() - ${FAILURE_WINDOW}::interval`) as { n: number }[];
    if ((recent?.n ?? 0) >= MAX_FAILURES) {
      return { error: "Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.", username };
    }

    const [user] = (await sql`select id::text as id, password_hash, disabled_at is not null as disabled
      from users where username = ${username}`) as { id: string; password_hash: string; disabled: boolean }[];
    // Kullanıcı yoksa da özet hesaplanır: yanıt süresi kullanıcı adının varlığını ele vermesin.
    const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) {
      await sql`insert into login_failures (username) values (${username})`;
      return { error: "Kullanıcı adı veya şifre hatalı.", username };
    }

    await sql`delete from login_failures where username = ${username}`;
    if (user.disabled) return { error: "Bu hesap devre dışı bırakılmış. Yöneticiyle iletişime geç.", username };
    await sql`update users set last_seen_at = now() where id = ${user.id}`;
    await startSession(user.id);
  } catch (e) {
    console.error("[auth] signIn", e);
    return { error: GENERIC, username };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  const username = normalizeUsername(text(fd, "username"));
  const password = text(fd, "password");
  const timezone = text(fd, "timezone").slice(0, 64);
  if (!USERNAME_RE.test(username)) return { error: USERNAME_HINT, username };
  if (password.length < MIN_PASSWORD) return { error: `Şifre en az ${MIN_PASSWORD} karakter olmalı.`, username };
  if (password.length > 256) return { error: "Şifre çok uzun.", username };

  const sql = db();
  try {
    if (!(await allow("signupIp", await clientIp())) || !(await allow("signupGlobal", "all"))) {
      return { error: RATE_LIMITED, username };
    }
    const [row] = (await sql`select register_user(${username}, ${await hashPassword(password)})::text as id`) as {
      id: string | null;
    }[];
    if (!row?.id) return { error: "Yeni kayıtlar şu an kapalı.", username };

    // Profil ve varsayılan kategoriler cihazın saat dilimiyle hemen oluşsun.
    await sql`select ensure_user(${row.id}, ${timezone || null})`;
    await startSession(row.id);
  } catch (e) {
    if (isDbError(e) && e.code === "23505") {
      return { error: "Bu kullanıcı adı alınmış. Başka bir tane dene.", username };
    }
    console.error("[auth] signUp", e);
    return { error: GENERIC, username };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function changePassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const user = await currentUser();
  if (!user) return { error: "Oturumunun süresi dolmuş. Lütfen yeniden giriş yap." };
  const current = text(fd, "current");
  const next = text(fd, "next");
  if (next.length < MIN_PASSWORD) return { error: `Yeni şifre en az ${MIN_PASSWORD} karakter olmalı.` };
  if (next.length > 256 || current.length > 256) return { error: "Şifre çok uzun." };

  const sql = db();
  try {
    if (!(await allow("passwordChange", user.userId))) return { error: RATE_LIMITED };
    const [row] = (await sql`select password_hash from users where id = ${user.userId}`) as {
      password_hash: string;
    }[];
    if (!row || !(await verifyPassword(current, row.password_hash))) {
      return { error: "Mevcut şifre hatalı." };
    }
    await sql`update users set password_hash = ${await hashPassword(next)} where id = ${user.userId}`;
    // Diğer cihazlardaki oturumları kapat, bu cihazda yeni oturum aç.
    await sql`delete from sessions where user_id = ${user.userId}`;
    await startSession(user.userId);
  } catch (e) {
    console.error("[auth] changePassword", e);
    return { error: GENERIC };
  }
  return { message: "Şifren güncellendi. Diğer cihazlarda yeniden giriş yapman gerekecek." };
}

export async function signOut() {
  try {
    await endSession();
  } catch (e) {
    console.error("[auth] signOut", e);
  }
  revalidatePath("/", "layout");
  redirect("/giris");
}
