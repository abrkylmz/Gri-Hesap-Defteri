"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportClientError } from "@/lib/actions/errors";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    // Yönetim panelindeki "Son hatalar"a (yalnızca mesaj ve sayfa; kişisel veri yok).
    reportClientError({ message: error.message, path: location.pathname, digest: error.digest }).catch(() => {});
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-start px-5 py-24">
      <p className="eyebrow">Hata</p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight">Bu sayfa şu an açılamadı.</h1>
      <p className="mt-3 text-ink-2">
        Bağlantında ya da sunucuda geçici bir sorun olabilir. Verilerin güvende; tekrar denemek genelde yeterli olur.
        Sorun sürerse ekibe haber verildi; Destek’ten de yazabilirsin.
      </p>
      {error.digest && <p className="num mt-2 text-xs text-ink-3">Hata kodu: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="btn btn-primary">
          Tekrar dene
        </button>
        <Link href="/destek" className="btn btn-ghost">
          Destek
        </Link>
      </div>
    </div>
  );
}
