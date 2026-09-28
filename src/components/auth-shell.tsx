import { DecorBarcode, Wordmark } from "@/components/ui";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="pt-safe grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line p-12 lg:flex">
        <Wordmark className="text-2xl" />
        <div className="rise">
          <p className="eyebrow mb-6">Kişisel muhasebe · Nº 01</p>
          <h1 className="font-serif text-7xl leading-[0.95] tracking-tight xl:text-8xl">
            Her ay,
            <br />
            <em className="text-ink-2">bir barkod.</em>
          </h1>
          <p className="mt-8 max-w-sm text-ink-2">
            Gelirini ve giderini gri bir deftere yaz. Her gün bir çizgi olur; ay sonunda paranın ritmini
            tek bakışta görürsün.
          </p>
        </div>
        <DecorBarcode className="max-w-md" />
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Wordmark className="text-2xl" />
            <DecorBarcode className="mt-8 h-16" />
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
