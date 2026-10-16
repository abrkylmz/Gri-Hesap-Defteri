import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { DecorBarcode } from "@/components/ui";

export const metadata: Metadata = { title: "Sayfa bulunamadı" };

/** 404: uygulamanın kendi görünümüyle, Türkçe. */
export default function NotFound() {
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <BrandLogo height={34} />
      <DecorBarcode className="mt-10 h-20 opacity-40" />
      <p className="eyebrow mt-10">Hata 404</p>
      <h1 className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight">
        Bu sayfa
        <br />
        <em className="text-ink-2">defterde yok.</em>
      </h1>
      <p className="mt-4 text-ink-2">
        Adres yanlış yazılmış ya da sayfa taşınmış olabilir. Verilerin güvende; ana sayfadan devam edebilirsin.
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/" className="btn btn-primary">
          Ana sayfaya dön
        </Link>
        <Link href="/destek" className="btn btn-ghost">
          Destek
        </Link>
      </div>
    </main>
  );
}
