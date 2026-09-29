"use client";

import Link from "next/link";
import { Plus, Wallet } from "lucide-react";
import { ASSET_BY_CODE, valueOf, type AssetCode, type Holding, type Rate } from "@/lib/assets";
import { useApp } from "@/components/app-context";
import { cn, Money } from "@/components/ui";
import { AssetIcon, amountText, assetGlyph, ChangePill, rateText } from "./asset-visuals";

/** Kur yokken (henüz çekilmediyse) kartlar gösterilmez. */
const DEFAULT_WATCH: AssetCode[] = ["USD", "EUR", "GAU", "CEYREK"];

export type AssetPosition = { code: AssetCode; amount: number; value: number; rate: Rate };

/** Birikimleri varlık türüne göre topla ve TL değerini hesapla. */
export function positions(holdings: Holding[], rates: Rate[]): AssetPosition[] {
  const rateBy = new Map(rates.map((r) => [r.code, r]));
  const sums = new Map<AssetCode, number>();
  for (const h of holdings) sums.set(h.asset, (sums.get(h.asset) ?? 0) + h.amount);
  return [...sums.entries()].flatMap(([code, amount]) => {
    const rate = rateBy.get(code);
    return rate ? [{ code, amount, value: valueOf(amount, rate.rate), rate }] : [];
  });
}

/**
 * Uygulamanın tepesindeki döviz & altın şeridi. Birikim varsa toplam ve varlık kartları,
 * yoksa güncel kurlar ve "Varlık ekle" kartı gösterilir.
 */
export function AssetStrip({ rates, holdings }: { rates: Rate[]; holdings: Holding[] }) {
  const { currency } = useApp();
  if (rates.length === 0) return null;
  const pos = positions(holdings, rates).sort((a, b) => b.value - a.value);
  const total = pos.reduce((s, p) => s + p.value, 0);
  // Bugünkü TL değişimi: her kalemin değeri × (değişim / (1 + değişim))
  const todayDelta = pos.reduce(
    (s, p) => s + (p.rate.change === null ? 0 : Math.round((p.value * p.rate.change) / (1 + p.rate.change))),
    0,
  );
  const watch = DEFAULT_WATCH.flatMap((c) => rates.filter((r) => r.code === c));

  return (
    <section aria-label="Döviz ve altın" className="rise -mx-5 lg:mx-0">
      <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-5 pb-2 pt-1 lg:px-0">
        {pos.length > 0 && (
          <Link
            href="/varliklar"
            className="card relative flex h-32 w-48 shrink-0 snap-start flex-col justify-between p-4 transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center gap-1.5 text-xs text-ink-2">
              <Wallet size={14} /> Döviz & altın
            </span>
            <span>
              <Money minor={total} currency={currency} className="block text-lg font-semibold" />
              {todayDelta !== 0 && (
                <Money
                  minor={todayDelta}
                  currency={currency}
                  sign
                  className={cn("text-xs", todayDelta > 0 ? "text-income" : "text-expense")}
                />
              )}
              {todayDelta !== 0 && <span className="text-xs text-ink-3"> bugün</span>}
            </span>
          </Link>
        )}

        {(pos.length > 0 ? pos.map((p) => ({ rate: p.rate, pos: p })) : watch.map((r) => ({ rate: r, pos: null }))).map(
          ({ rate, pos: p }) => {
            const def = ASSET_BY_CODE.get(rate.code)!;
            return (
              <Link
                key={rate.code}
                href="/varliklar"
                aria-label={`${def.label}: ${rateText(rate.rate)}`}
                className={cn(
                  "relative isolate flex h-32 w-48 shrink-0 snap-start flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br p-4 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.45)] transition-transform active:scale-[0.98]",
                  def.theme,
                )}
              >
                {/* Parlama ve büyük soluk sembol */}
                <span
                  aria-hidden
                  className="absolute -right-6 -top-10 -z-10 size-32 rounded-full bg-white/25 blur-2xl"
                />
                <span
                  aria-hidden
                  className="absolute -bottom-6 right-2 -z-10 font-serif text-[5.5rem] italic leading-none opacity-15"
                >
                  {assetGlyph(def)}
                </span>

                <span className="flex items-center justify-between">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/30 shadow-inner backdrop-blur-sm">
                      <AssetIcon code={rate.code} size={16} />
                    </span>
                    <span className="truncate whitespace-nowrap text-sm font-semibold">{def.short}</span>
                  </span>
                  <ChangePill change={rate.change} />
                </span>

                {p ? (
                  <span>
                    <span className="num block text-lg font-semibold leading-tight">
                      <Money minor={p.value} currency={currency} fracClassName="opacity-60" />
                    </span>
                    <span className="num block text-[11px] opacity-80">
                      {amountText(def, p.amount)} · {rateText(rate.rate)}
                    </span>
                  </span>
                ) : (
                  <span>
                    <span className="num block text-xl font-semibold leading-tight">{rateText(rate.rate)}</span>
                    <span className="block text-[11px] opacity-80">
                      1 {def.kind === "currency" ? def.unit : def.unit === "gr" ? "gram" : "adet"}
                    </span>
                  </span>
                )}
              </Link>
            );
          },
        )}

        <Link
          href="/varliklar?ekle=1"
          className="flex h-32 w-32 shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <span className="grid size-9 place-items-center rounded-full bg-surface-2">
            <Plus size={18} />
          </span>
          Varlık ekle
        </Link>
      </div>
    </section>
  );
}
