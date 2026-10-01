"use client";

import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useId } from "react";
import { ASSET_BY_CODE, type AssetCode, type AssetKind, type Holding, type Rate } from "@/lib/assets";
import { cn } from "@/components/ui";
import { AssetIcon } from "./asset-visuals";

const DEFAULT_WATCH: AssetCode[] = ["USD", "EUR", "GAU", "CEYREK"];
const MAX_ITEMS = 4;
const rateFmt = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Kart tonları: hafif renkli zemin, dolu renkli simge, renkli hap ve çizgi. Açık/koyu temada çalışır. */
type Tone = { card: string; icon: string; pill: string; line: string };
const TONES: Record<"USD" | "EUR" | "GBP" | AssetKind, Tone> = {
  USD: {
    card: "bg-emerald-500/[0.07] border-emerald-500/15",
    icon: "from-emerald-400 to-emerald-700 text-white",
    pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    line: "text-emerald-500",
  },
  EUR: {
    card: "bg-blue-500/[0.07] border-blue-500/15",
    icon: "from-blue-400 to-indigo-700 text-white",
    pill: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    line: "text-blue-500",
  },
  GBP: {
    card: "bg-violet-500/[0.07] border-violet-500/15",
    icon: "from-violet-400 to-purple-700 text-white",
    pill: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    line: "text-violet-500",
  },
  currency: {
    card: "bg-surface border-line",
    icon: "from-slate-400 to-slate-600 text-white",
    pill: "bg-surface-2 text-ink-2",
    line: "text-ink-3",
  },
  gold: {
    card: "bg-amber-400/[0.09] border-amber-500/15",
    icon: "from-amber-200 to-amber-500 text-amber-950",
    pill: "bg-amber-400/20 text-amber-800 dark:text-amber-300",
    line: "text-amber-500",
  },
  silver: {
    card: "bg-slate-400/[0.09] border-slate-400/20",
    icon: "from-slate-200 to-slate-400 text-slate-900",
    pill: "bg-slate-400/20 text-slate-700 dark:text-slate-300",
    line: "text-slate-400",
  },
};
const toneOf = (code: AssetCode): Tone =>
  code === "USD" || code === "EUR" || code === "GBP" ? TONES[code] : TONES[ASSET_BY_CODE.get(code)!.kind];

/**
 * Ana ekranın tepesindeki kur kartları: güncel kur, günlük değişim ve son günlerin mini grafiği.
 * `beside`: masaüstünde nakit kartının yanında 2×2 dizilir; yoksa tek sırada dörtlü.
 */
export function RateTicker({ rates, holdings, beside = false }: { rates: Rate[]; holdings: Holding[]; beside?: boolean }) {
  if (rates.length === 0) return null;
  const rateBy = new Map(rates.map((r) => [r.code, r]));
  const codes = [...new Set([...holdings.map((h) => h.asset), ...DEFAULT_WATCH])]
    .filter((c) => rateBy.has(c))
    .slice(0, MAX_ITEMS);

  return (
    <nav aria-label="Güncel kurlar" className="rise -mx-5 lg:mx-0">
      <div
        data-no-swipe
        className={cn(
          "no-scrollbar flex snap-x gap-3 overflow-x-auto px-5 pb-1 pt-1 lg:grid lg:overflow-visible lg:px-0",
          beside ? "lg:grid-cols-2" : "lg:grid-cols-4",
        )}
      >
        {codes.map((code) => (
          <RateCard key={code} rate={rateBy.get(code)!} />
        ))}
      </div>
    </nav>
  );
}

function RateCard({ rate }: { rate: Rate }) {
  const def = ASSET_BY_CODE.get(rate.code)!;
  const tone = toneOf(rate.code);
  const up = (rate.change ?? 0) >= 0;
  const Trend = up ? TrendingUp : TrendingDown;
  return (
    <Link
      href="/varliklar"
      aria-label={`${def.label}: ${rateFmt.format(rate.rate)} lira`}
      className={cn(
        "flex w-[12.5rem] shrink-0 snap-start flex-col gap-2 rounded-2xl border p-3 transition-[transform,box-shadow] hover:shadow-[0_8px_24px_-14px_rgb(0_0_0/0.35)] active:scale-[0.98] lg:w-auto",
        tone.card,
      )}
    >
      {/* Üst: simge, ad, günlük değişim */}
      <span className="flex items-center gap-2">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br shadow-sm", tone.icon)}>
          <AssetIcon code={rate.code} size={15} />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-2">{def.short}</span>
        {rate.change !== null && (
          <span
            className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", tone.pill)}
            title="Önceki güne göre"
          >
            <Trend size={11} strokeWidth={2.5} />%{pctFmt.format(Math.abs(rate.change * 100))}
          </span>
        )}
      </span>
      {/* Alt: kur ve son günlerin grafiği */}
      <span className="flex items-end justify-between gap-2">
        <span className="num whitespace-nowrap text-xl font-semibold leading-none tracking-tight">
          {rateFmt.format(rate.rate)}
        </span>
        <Sparkline values={rate.history ?? []} className={cn("shrink-0", tone.line)} />
      </span>
    </Link>
  );
}

/** Mini çizgi grafik (alanı hafif dolu). İki günden az veri varsa düz bir çizgi. */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const id = `spark${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const w = 56;
  const h = 18;
  const pts = values.length >= 2 ? values : [1, 1];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
