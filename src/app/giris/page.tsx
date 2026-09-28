import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { currentUser } from "@/lib/auth";
import { allowMoreSignups, missingEnv } from "@/lib/config";
import { db, isDbError } from "@/lib/db";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage() {
  if (missingEnv().length > 0) redirect("/kurulum");

  let signedIn = false;
  let hasUsers = true;
  try {
    signedIn = Boolean(await currentUser());
    const [row] = (await db()`select exists (select 1 from users) as has`) as { has: boolean }[];
    hasUsers = Boolean(row?.has);
  } catch (e) {
    // Tablo yoksa şema henüz kurulmamıştır.
    if (isDbError(e) && e.code === "42P01") redirect("/kurulum");
    throw e;
  }
  if (signedIn) redirect("/");

  return (
    <AuthShell>
      <LoginForm firstRun={!hasUsers} canSignUp={!hasUsers || allowMoreSignups()} />
    </AuthShell>
  );
}
