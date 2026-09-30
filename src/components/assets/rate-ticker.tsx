"use client";

import Link from "next/link";
import { ASSET_BY_CODE, type AssetCode, type Holding, type Rate } from "@/lib/assets";
import { cn } from "@/components/ui";
import { AssetIcon, ChangePill } from "./asset-visuals";

const DEFAULT_WATCH: AssetCode[] = ["USD", "EUR", "GAU", "CEYREK"];
const MAX_ITEMS = 6;
const rateFmt = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Ana ekranın tepesindeki ince kur şeridi: küçük, temalı dikdörtgenlerde güncel kur ve günlük
 * değişim. Sahip olunan varlıklar önce gelir; birikimlerin TL değeri "Varlıklarım" kartındadır.
 */
export function RateTicker({ rates, holdings }: { rates: Rate[]; holdings: Holding[] }) {
  if (rates.length === 0) return null;
  const rateBy = new Map(rates.map((r) => [r.code, r]));
  const codes = [...new Set([...holdings.map((h) => h.asset), ...DEFAULT_WATCH])]
    .filter((c) => rateBy.has(c))
    .slice(0, MAX_ITEMS);

  return (
    <nav aria-label="Güncel kurlar" className="rise -mx-5 lg:mx-0">
      <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-5 pb-1 pt-1 lg:px-0" data-no-swipe>
        {codes.map((code) => {
          const def = ASSET_BY_CODE.get(code)!;
          const rate = rateBy.get(code)!;
          return (
            <Link
              key={code}
              href="/varliklar"
              aria-label={`${def.label}: ${rateFmt.format(rate.rate)} lira`}
              className={cn(
                "flex h-12 shrink-0 snap-start items-center gap-2 rounded-2xl bg-gradient-to-br py-1.5 pl-2 pr-2.5 shadow-[0_6px_16px_-10px_rgb(0_0_0/0.5)] saturate-[0.8] brightness-[0.93] transition-transform active:scale-[0.97]",
                def.theme,
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/30">
                <AssetIcon code={code} size={14} />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="whitespace-nowrap text-[10px] font-medium opacity-80">{def.short}</span>
                <span className="num whitespace-nowrap text-sm font-semibold">{rateFmt.format(rate.rate)}</span>
              </span>
              <ChangePill change={rate.change} className="self-start" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
