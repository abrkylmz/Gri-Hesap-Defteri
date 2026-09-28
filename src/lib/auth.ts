import { cache } from "react";
import { redirect } from "next/navigation";
import { createNeonAuth } from "@neondatabase/auth/next/server";

type NeonAuth = ReturnType<typeof createNeonAuth>;

/** Eksik ya da hatalı zorunlu ortam değişkenlerinin adları (değerleri asla döndürülmez). */
export function missingEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.NEON_AUTH_BASE_URL) missing.push("NEON_AUTH_BASE_URL");
  if ((process.env.NEON_AUTH_COOKIE_SECRET ?? "").length < 32) missing.push("NEON_AUTH_COOKIE_SECRET");
  return missing;
}
let instance: NeonAuth | null = null;

/** Tembel oluşturma: derleme sırasında ortam değişkeni olmadan modülün yüklenebilmesi için. */
export function getAuth(): NeonAuth {
  if (!instance) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const secret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl || !secret) {
      throw new Error("NEON_AUTH_BASE_URL ve NEON_AUTH_COOKIE_SECRET tanımlı olmalı (.env.example).");
    }
    instance = createNeonAuth({ baseUrl, cookies: { secret } });
  }
  return instance;
}

export type SessionUser = { userId: string; email: string };

/** Oturumdaki kullanıcı; yoksa null. İstek başına bir kez çalışır. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const { data } = await getAuth().getSession();
  const user = data?.user;
  if (!user?.id) return null;
  return { userId: String(user.id), email: user.email ?? "" };
});

/** Oturum yoksa giriş sayfasına yönlendirir. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/giris");
  return user;
}
