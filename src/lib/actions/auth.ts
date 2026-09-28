"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export type AuthState = { error?: string; message?: string; email?: string } | null;

type AuthErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

async function siteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function authMessage(error: AuthErrorLike): string {
  if (error?.status === 429) return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.";
  switch (error?.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_PASSWORD":
      return "E-posta veya şifre hatalı.";
    case "EMAIL_NOT_VERIFIED":
      return "E-postanı henüz onaylamadın. Gelen kutunu (ve spam klasörünü) kontrol et.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.";
    case "PASSWORD_TOO_SHORT":
      return `Şifre en az ${MIN_PASSWORD} karakter olmalı.`;
    case "PASSWORD_TOO_LONG":
      return "Şifre çok uzun.";
    case "INVALID_EMAIL":
      return "Geçerli bir e-posta adresi gir.";
    case "INVALID_TOKEN":
      return "Bağlantının süresi dolmuş ya da geçersiz. Yeni bir sıfırlama bağlantısı iste.";
    default:
      console.error("[auth]", error);
      return "Bir şeyler ters gitti. Lütfen tekrar dene.";
  }
}

const field = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = field(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!EMAIL_RE.test(email) || !password) return { error: "E-posta ve şifreni gir.", email };

  const { error } = await getAuth().signIn.email({ email, password });
  if (error) return { error: authMessage(error), email };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = field(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const timezone = field(fd, "timezone").slice(0, 64);
  if (!EMAIL_RE.test(email)) return { error: "Geçerli bir e-posta adresi gir.", email };
  if (password.length < MIN_PASSWORD) {
    return { error: `Şifre en az ${MIN_PASSWORD} karakter olmalı.`, email };
  }

  const { data, error } = await getAuth().signUp.email({
    email,
    password,
    name: email.split("@")[0] ?? email,
    callbackURL: `${await siteUrl()}/`,
  });
  if (error) return { error: authMessage(error), email };

  // Profil ve varsayılan kategoriler, cihazın saat dilimiyle hemen oluşturulsun.
  const userId = data?.user?.id;
  if (userId) {
    try {
      await db()`select ensure_user(${String(userId)}, ${timezone || null})`;
    } catch (e) {
      console.error("ensure_user", e); // ilk sayfa yüklemesinde yeniden denenir
    }
  }

  if (data?.token) {
    revalidatePath("/", "layout");
    redirect("/");
  }
  return {
    message: "Neredeyse tamam! Hesabını etkinleştirmek için e-postana gelen bağlantıya tıkla.",
    email,
  };
}

export async function requestPasswordReset(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = field(fd, "email").toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Geçerli bir e-posta adresi gir.", email };

  const { error } = await getAuth().requestPasswordReset({
    email,
    redirectTo: `${await siteUrl()}/sifre-yenile`,
  });
  if (error?.status === 429) return { error: authMessage(error), email };
  if (error) console.error("[auth] requestPasswordReset", error);

  // Hesabın var olup olmadığını sızdırmamak için her durumda aynı yanıt.
  return { message: "Bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.", email };
}

export async function resetPassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const token = field(fd, "token");
  const password = String(fd.get("password") ?? "");
  if (!token) return { error: authMessage({ code: "INVALID_TOKEN" }) };
  if (password.length < MIN_PASSWORD) return { error: `Şifre en az ${MIN_PASSWORD} karakter olmalı.` };

  const { error } = await getAuth().resetPassword({ newPassword: password, token });
  if (error) return { error: authMessage(error) };

  redirect("/giris?sifre=yenilendi");
}

export async function signOut() {
  await getAuth().signOut();
  revalidatePath("/", "layout");
  redirect("/giris");
}
