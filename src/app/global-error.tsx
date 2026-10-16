"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/actions/errors";
import "./globals.css";

/** Kök düzen bile çizilemezse: sade, Türkçe hata sayfası (kendi html/body'si ile). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError({ message: `[global] ${error.message}`, path: location.pathname, digest: error.digest }).catch(
      () => {},
    );
  }, [error]);

  return (
    <html lang="tr">
      <body>
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
          <p className="eyebrow">Beklenmeyen hata</p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight">Gri Hesap Defteri açılamadı.</h1>
          <p className="mt-3 text-ink-2">
            Geçici bir sorun oluştu. Verilerin güvende. Sayfayı yenilemeyi dene; sürerse birkaç dakika sonra tekrar
            gir.
          </p>
          {error.digest && <p className="mt-2 text-xs text-ink-3">Hata kodu: {error.digest}</p>}
          <button type="button" onClick={reset} className="btn btn-primary mt-8 self-start">
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
