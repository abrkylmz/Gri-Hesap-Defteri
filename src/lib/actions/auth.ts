"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string; email?: string } | null;

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

function authMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "E-posta veya şifre hatalı.";
    case "email_not_confirmed":
      return "E-postanı henüz onaylamadın. Gelen kutunu (ve spam klasörünü) kontrol et.";
    case "user_already_exists":
    case "email_exists":
      return "Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.";
    case "weak_password":
      return "Şifre çok zayıf. Harf, rakam ve sembol karıştırarak tekrar dene.";
    case "same_password":
      return "Yeni şifre eskisiyle aynı olamaz.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.";
    case "signup_disabled":
      return "Yeni kayıtlar şu an kapalı.";
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authMessage(error), email };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = field(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const timezone = field(fd, "timezone");
  if (!EMAIL_RE.test(email)) return { error: "Geçerli bir e-posta adresi gir.", email };
  if (password.length < MIN_PASSWORD) {
    return { error: `Şifre en az ${MIN_PASSWORD} karakter olmalı.`, email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/`,
      data: { timezone: timezone.slice(0, 64) },
    },
  });
  if (error) return { error: authMessage(error), email };

  if (data.session) {
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

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/sifre-yenile`,
  });
  if (error && error.code?.startsWith("over_")) return { error: authMessage(error), email };

  // Hesabın var olup olmadığını sızdırmamak için her durumda aynı yanıt.
  return { message: "Bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.", email };
}

export async function updatePassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { error: `Şifre en az ${MIN_PASSWORD} karakter olmalı.` };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authMessage(error) };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/giris");
}
