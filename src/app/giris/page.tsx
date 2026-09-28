import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { currentUser } from "@/lib/auth";
import { missingEnv } from "@/lib/config";
import { db, isDbError } from "@/lib/db";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage() {
  if (missingEnv().length > 0) redirect("/kurulum");

  let signedIn = false;
  let hasUsers = true;
  let signupOpen = true;
  try {
    signedIn = Boolean(await currentUser());
    const [row] = (await db()`select exists (select 1 from users) as has,
      coalesce((select value from app_settings where key = 'signup_open'), 'true') = 'true' as open`) as {
      has: boolean;
      open: boolean;
    }[];
    hasUsers = Boolean(row?.has);
    signupOpen = Boolean(row?.open);
  } catch (e) {
    // Tablo yoksa şema henüz kurulmamıştır.
    if (isDbError(e) && e.code === "42P01") redirect("/kurulum");
    throw e;
  }
  if (signedIn) redirect("/");

  return (
    <AuthShell>
      <LoginForm firstRun={!hasUsers} canSignUp={!hasUsers || signupOpen} />
    </AuthShell>
  );
}
