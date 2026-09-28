import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { missingEnv } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kurulum", robots: { index: false } };

const HINTS: Record<string, string> = {
  DATABASE_URL: "Vercel → Storage → Neon veritabanını projeye bağla (otomatik eklenir).",
  NEON_AUTH_BASE_URL: "Neon Console → Auth bölümündeki Auth URL.",
  NEON_AUTH_COOKIE_SECRET: "En az 32 karakterlik rastgele bir değer.",
};

// Yalnızca değişken adlarını gösterir; hiçbir değeri ifşa etmez.
export default function SetupPage() {
  const missing = missingEnv();
  if (missing.length === 0) redirect("/");

  return (
    <AuthShell>
      <div className="rise">
        <p className="eyebrow">Kurulum</p>
        <h2 className="mt-2 font-serif text-4xl tracking-tight">Defter henüz hazır değil.</h2>
        <p className="mt-2 text-sm text-ink-2">
          Şu ortam değişkenleri eksik ya da hatalı. Vercel → Settings → Environment Variables bölümüne
          ekleyip yeniden deploy et.
        </p>
        <ul className="mt-6 space-y-3">
          {missing.map((name) => (
            <li key={name} className="card px-4 py-3">
              <code className="num text-sm font-medium">{name}</code>
              <p className="mt-1 text-xs text-ink-3">{HINTS[name]}</p>
            </li>
          ))}
        </ul>
      </div>
    </AuthShell>
  );
}
