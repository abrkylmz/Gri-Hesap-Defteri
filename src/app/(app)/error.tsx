"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-start px-5 py-24">
      <p className="eyebrow">Hata</p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight">Defter şu an açılamadı.</h1>
      <p className="mt-3 text-ink-2">
        Bağlantında ya da sunucuda geçici bir sorun olabilir. Verilerin güvende; tekrar denemek genelde
        yeterli olur.
      </p>
      <button type="button" onClick={reset} className="btn btn-primary mt-8">
        Tekrar dene
      </button>
    </div>
  );
}
