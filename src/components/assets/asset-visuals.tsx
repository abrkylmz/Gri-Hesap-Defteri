"use client";

import { DollarSign, Euro, PoundSterling, TrendingDown, TrendingUp } from "lucide-react";
import { ASSET_BY_CODE, type AssetCode, type AssetDef } from "@/lib/assets";
import { cn } from "@/components/ui";

/** Altın / gümüş külçe simgesi (lucide'da yok). */
export function IngotIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M3 18.5 5.6 12h7.8l2.6 6.5H3Z" fill="currentColor" opacity=".9" />
      <path d="M8 11 10.6 4.5h7.8L21 11H8Z" fill="currentColor" opacity=".55" />
      <path d="M13.8 12h5.6l2.6 6.5h-5.6L13.8 12Z" fill="currentColor" opacity=".7" />
    </svg>
  );
}

export function AssetIcon({ code, size = 18 }: { code: AssetCode; size?: number }) {
  if (code === "USD") return <DollarSign size={size} strokeWidth={2.5} />;
  if (code === "EUR") return <Euro size={size} strokeWidth={2.5} />;
  if (code === "GBP") return <PoundSterling size={size} strokeWidth={2.5} />;
  const def = ASSET_BY_CODE.get(code);
  // Diğer dövizler: kendi kısa işaretleri (Fr, ¥, C$, kr…)
  if (def?.kind === "currency" && def.symbol) {
    return (
      <span
        className="font-sans font-bold leading-none tracking-tight"
        style={{ fontSize: size * (def.symbol.length > 1 ? 0.62 : 0.95) }}
      >
        {def.symbol}
      </span>
    );
  }
  return <IngotIcon size={size} />;
}

/** Kartın arka planındaki büyük, soluk sembol. */
export const assetGlyph = (a: AssetDef) =>
  a.kind === "currency" ? a.unit : a.kind === "silver" ? "Ag" : "Au";

const pct = new Intl.NumberFormat("tr-TR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Günlük değişim hapı: ▲ %0,42 */
export function ChangePill({ change, className }: { change: number | null; className?: string }) {
  if (change === null) return null;
  const up = change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm dark:bg-white/15",
        className,
      )}
      title="Önceki güne göre"
    >
      <Icon size={11} strokeWidth={2.5} />
      {pct.format(Math.abs(change))}
    </span>
  );
}

const two = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 4 });

/** 1 birimin kuru: "48,99 ₺" */
export const rateText = (rate: number) => `${two.format(rate)} ₺`;

/** Miktar gösterimi: "1.500 $", "12,5 gr", "3 adet" */
export const amountText = (a: AssetDef, amount: number) =>
  a.kind === "currency" ? `${qty.format(amount)} ${a.unit}` : `${qty.format(amount)} ${a.unit}`;
