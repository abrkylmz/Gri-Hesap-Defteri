import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { missingEnv } from "@/lib/config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kurulum", robots: { index: false } };

/** Şema kurulmuş mu? (users tablosu en son eklenen tablodur.) */
async function schemaReady() {
  try {
    const [row] = (await db()`select to_regclass('public.users') is not null as ok`) as { ok: boolean }[];
    return Boolean(row?.ok);
  } catch (e) {
    console.error("[kurulum] şema kontrolü", e);
    return false;
  }
}

// Yalnızca eksik adımları gösterir; hiçbir gizli değeri ifşa etmez.
export default async function SetupPage() {
  const missing = missingEnv();
  const schemaOk = missing.length === 0 && (await schemaReady());
  if (missing.length === 0 && schemaOk) redirect("/giris");

  return (
    <AuthShell>
      <div className="rise">
        <p className="eyebrow">Kurulum</p>
        <h2 className="mt-2 font-serif text-4xl tracking-tight">Defter henüz hazır değil.</h2>
        <ul className="mt-6 space-y-3">
          {missing.includes("DATABASE_URL") ? (
            <li className="card px-4 py-3">
              <code className="num text-sm font-medium">DATABASE_URL</code>
              <p className="mt-1 text-xs leading-relaxed text-ink-3">
                Vercel → Storage → Neon veritabanını projeye bağla (Environments: All Environments), sonra
                Deployments → Redeploy.
              </p>
            </li>
          ) : (
            <li className="card px-4 py-3">
              <p className="text-sm font-medium">Veritabanı tabloları eksik ya da eski</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-3">
                Neon Console → SQL Editor&apos;da projedeki <code>db/schema.sql</code> dosyasını çalıştır, ardından
                bu sayfayı yenile. Betik tekrar çalıştırılabilir; mevcut verileri silmez.
              </p>
            </li>
          )}
        </ul>
      </div>
    </AuthShell>
  );
}
