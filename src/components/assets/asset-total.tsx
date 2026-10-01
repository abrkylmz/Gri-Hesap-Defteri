"use client";

import { moneyParts } from "@/lib/money";
import { useApp } from "@/components/app-context";
import { useCountUp } from "@/components/use-count-up";
import { cn, Money } from "@/components/ui";

export type TotalPart = { key: string; label: string; value: number; tone: string };

/**
 * Varlıklar sayfasının tepesi: tüm varlıkların toplam TL değeri, dağılım çubuğu ve kalem kalem
 * (nakit, döviz & altın, kripto). Limitler borç verme kapasitesi olduğu için dahil değildir.
 */
export function AssetTotal({ parts }: { parts: TotalPart[] }) {
  const { currency } = useApp();
  const total = parts.reduce((s, p) => s + p.value, 0);
  const big = moneyParts(useCountUp(total, "all-assets-total"), currency);
  const shown = parts.filter((p) => p.value > 0);

  return (
    <section className="rise mt-6" aria-label="Toplam varlık">
      <p className="eyebrow">Toplam varlık</p>
      <p className="keep-serif mt-3 flex items-start font-serif text-[clamp(3rem,13vw,6rem)] leading-[0.85] tracking-[-0.03em]">
        <span className="mr-[0.04em] mt-[0.08em] font-sans text-[0.3em] font-light text-ink-3">{big.symbol}</span>
        <span className="italic tabular-nums">{big.int}</span>
        <span className="num mb-[0.06em] ml-[0.04em] self-end text-[0.24em] not-italic leading-none text-ink-3">
          ,{big.frac}
        </span>
      </p>

      {total > 0 ? (
        <>
          <div className="mt-5 flex h-2.5 gap-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            {shown.map((p) => (
              <span key={p.key} className={cn("h-full rounded-full", p.tone)} style={{ flexGrow: p.value }} />
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
            {parts.map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-3 sm:block">
                <dt className="flex items-center gap-2 text-xs text-ink-2">
                  <span className={cn("size-2.5 rounded-full", p.tone)} />
                  {p.label}
                  {p.value > 0 && <span className="num text-ink-3">%{Math.round((p.value / total) * 100)}</span>}
                </dt>
                <dd className="text-sm font-semibold sm:mt-1">
                  <Money minor={p.value} currency={currency} fracClassName="opacity-40" />
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-2">Nakit, döviz, altın ya da kripto ekledikçe toplam burada görünür.</p>
      )}
    </section>
  );
}
