import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Notice } from "@/components/ui";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Yeni şifre" };

// E-postadaki sıfırlama bağlantısı buraya ?token=... ile döner.
export default async function NewPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token, error } = await searchParams;
  const valid = typeof token === "string" && token.length > 0 && !error;

  return (
    <AuthShell>
      <div className="rise">
        <h2 className="font-serif text-4xl tracking-tight">Yeni şifre belirle.</h2>
        {valid ? (
          <>
            <p className="mt-2 text-sm text-ink-2">Bundan sonra bu şifreyle giriş yapacaksın.</p>
            <NewPasswordForm token={token} />
          </>
        ) : (
          <div className="mt-6 space-y-6">
            <Notice tone="error">
              Bağlantının süresi dolmuş ya da geçersiz. Yeni bir sıfırlama bağlantısı iste.
            </Notice>
            <Link href="/sifre-sifirla" className="btn btn-primary w-full">
              Yeni bağlantı iste
            </Link>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
