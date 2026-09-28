import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { currentUser, missingEnv } from "@/lib/auth";
import { LoginForm } from "./login-form";

// Oturum çerezine bağlı: statik ön-render denenmesin (Neon Auth önerisi).
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (missingEnv().length > 0) redirect("/kurulum");
  if (await currentUser()) redirect("/");
  const { sifre } = await searchParams;
  return (
    <AuthShell>
      <LoginForm passwordReset={sifre === "yenilendi"} />
    </AuthShell>
  );
}
