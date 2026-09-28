import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { hata } = await searchParams;
  return (
    <AuthShell>
      <LoginForm linkError={hata === "baglanti"} />
    </AuthShell>
  );
}
