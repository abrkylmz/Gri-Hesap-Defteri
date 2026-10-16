"use client";

import { Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import type { NetWorthPoint } from "@/lib/net-worth";
import { useApp } from "@/components/app-context";
import { cn, Money } from "@/components/ui";

const W = 320;
const H = 96;
const PAD = 6;
const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
const pctFmt = new Intl.NumberFormat("tr-TR", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const RANGES = [
  { key: 30, label: "1 ay" },
  { key: 90, label: "3 ay" },
  { key: 365, label: "1 yıl" },
] as const;

/**
 * Net varlık (varlıklar − borçlar) ve günlük geçmişin çizgi grafiği. Bugünün değeri sayfadaki canlı
 * toplamdan gelir; geçmiş, Varlıklar sayfası her açıldığında günde bir nokta olarak kaydedilir.
 */
export function NetWorthCard({
  history,
  assets,
  debts,
}: {
  history: NetWorthPoint[];
  /** Bugünün canlı varlık toplamı (kuruş) */
  assets: number;
  /** Kart borçları + kalan kredi taksitleri (kuruş) */
  debts: number;
}) {
  const { currency, today } = useApp();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>(90);
  const net = assets - debts;

  // Geçmiş + bugünün canlı noktası (bugünkü kayıt varsa onun yerine)
  const all = [...history.filter((p) => p.day !== today), { day: today, assets, debts }];
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - range * 86_400_000).toISOString().slice(0, 10);
  const pts = all.filter((p) => p.day >= cutoff);
  const values = pts.map((p) => p.assets - p.debts);
  const diff = pts.length > 1 ? net - values[0]! : null;
  const up = (diff ?? 0) >= 0;

  let path = "";
  let area = "";
  if (pts.length > 1) {
    const t0 = Date.parse(`${pts[0]!.day}T00:00:00Z`);
    const t1 = Date.parse(`${today}T00:00:00Z`);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.abs(max) || 1;
    const x = (day: string) => PAD + ((Date.parse(`${day}T00:00:00Z`) - t0) / Math.max(1, t1 - t0)) * (W - PAD * 2);
    const y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
    path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(values[i]!).toFixed(1)}`).join(" ");
    area = `${path} L${x(today).toFixed(1)},${H} L${x(pts[0]!.day).toFixed(1)},${H} Z`;
  }

  return (
    <section className="card rise mt-6 p-4 sm:p-5" aria-label="Net varlık">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
            <span className="grid size-7 place-items-center rounded-lg bg-sky-500/12 text-sky-700 dark:text-sky-300">
              <Scale size={15} />
            </span>
            Net varlık
          </p>
          <Money
            minor={net}
            currency={currency}
            sign={net < 0}
            fracClassName="opacity-40"
            className={cn(
              "mt-2 block text-[1.75rem] font-semibold leading-none tracking-tight",
              net < 0 && "text-expense",
            )}
          />
          {diff !== null && (
            <p
              className={cn("mt-1.5 flex items-center gap-1 text-xs font-medium", up ? "text-income" : "text-expense")}
            >
              {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              <Money minor={diff} currency={currency} sign />
              {values[0] !== 0 && <span>({pctFmt.format(diff / Math.abs(values[0]!))})</span>}
              <span className="font-normal text-ink-3">
                · {dayFmt.format(Date.parse(`${pts[0]!.day}T00:00:00Z`))}’den beri
              </span>
            </p>
          )}
        </div>
        <div role="radiogroup" aria-label="Dönem" className="flex rounded-full bg-surface-2 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={range === r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "h-7 rounded-full px-2.5 text-xs font-medium transition-colors",
                range === r.key ? "bg-surface text-ink shadow-sm" : "text-ink-3",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {pts.length > 1 ? (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-4 h-24 w-full overflow-visible"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="nw-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={up ? "var(--income-fill)" : "var(--expense)"} stopOpacity="0.28" />
              <stop offset="100%" stopColor={up ? "var(--income-fill)" : "var(--expense)"} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#nw-fill)" />
          <path
            d={path}
            fill="none"
            stroke={up ? "var(--income)" : "var(--expense)"}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <p className="mt-4 rounded-2xl bg-surface-2/60 px-4 py-3 text-xs leading-relaxed text-ink-2">
          Grafik her gün bir nokta ekler. Varlıklar sayfasını açtığın günlerde net varlığın kaydedilir; birkaç gün sonra
          burada nasıl değiştiğini görürsün.
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-surface-2/60 px-3 py-2">
          <dt className="text-ink-3">Varlıklar</dt>
          <dd className="mt-0.5 font-semibold">
            <Money minor={assets} currency={currency} fracClassName="opacity-40" />
          </dd>
        </div>
        <div className="rounded-xl bg-surface-2/60 px-3 py-2">
          <dt className="text-ink-3">Borçlar (kart + kredi)</dt>
          <dd className={cn("mt-0.5 font-semibold", debts > 0 && "text-expense")}>
            <Money minor={debts} currency={currency} fracClassName="opacity-40" />
          </dd>
        </div>
      </dl>
    </section>
  );
}
