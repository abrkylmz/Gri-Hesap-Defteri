"use client";

import Link from "next/link";
import { ChartLine, SlidersHorizontal, TrendingDown, TrendingUp } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { saveWatchList } from "@/lib/actions/holdings";
import {
  ASSET_BY_CODE,
  ASSETS,
  DEFAULT_WATCH,
  MAX_WATCH,
  type AssetCode,
  type AssetKind,
  type Holding,
  type Rate,
} from "@/lib/assets";
import { haptic } from "@/lib/haptics";
import { Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Spinner } from "@/components/ui";
import { AssetIcon } from "./asset-visuals";

const rateFmt = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Kart tonları: hafif renkli zemin, dolu renkli simge, renkli hap ve çizgi. Açık/koyu temada çalışır. */
type Tone = { card: string; icon: string; pill: string; line: string };
const TONES: Record<"USD" | "EUR" | "GBP" | "CHF" | AssetKind, Tone> = {
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
  CHF: {
    card: "bg-red-500/[0.06] border-red-500/15",
    icon: "from-rose-400 to-red-700 text-white",
    pill: "bg-red-500/15 text-red-700 dark:text-red-300",
    line: "text-red-500",
  },
  // Diğer dövizler
  currency: {
    card: "bg-cyan-500/[0.07] border-cyan-500/15",
    icon: "from-teal-400 to-sky-700 text-white",
    pill: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",
    line: "text-cyan-500",
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
  code === "USD" || code === "EUR" || code === "GBP" || code === "CHF"
    ? TONES[code]
    : TONES[ASSET_BY_CODE.get(code)!.kind];

/**
 * Ana ekranın tepesindeki kur kartları: güncel kur, günlük değişim ve son günlerin mini grafiği.
 * Hangi kurların gösterileceği "Düzenle" ile seçilir (kişisel, tüm cihazlarda aynı).
 * `beside`: masaüstünde nakit kartının yanında iki sütun; yoksa tek sırada dörtlü.
 */
export function RateTicker({
  rates,
  holdings,
  watch,
  beside = false,
}: {
  rates: Rate[];
  holdings: Holding[];
  /** Kullanıcının seçtiği kurlar; null → elindeki varlıklar + varsayılanlar */
  watch: AssetCode[] | null;
  beside?: boolean;
}) {
  const sheet = useSheetState<AssetCode[]>();
  if (rates.length === 0) return null;
  const rateBy = new Map(rates.map((r) => [r.code, r]));
  const chosen = watch ?? [...new Set([...holdings.map((h) => h.asset), ...DEFAULT_WATCH])].slice(0, 4);
  const codes = chosen.filter((c) => rateBy.has(c));

  return (
    <nav aria-label="Güncel kurlar" className="rise -mx-5 lg:mx-0">
      {/* Başlık: nakit kartıyla aynı belirginlikte (soluk küçük etiket iPhone'da arka plana karışıyordu). */}
      <div className="mb-2.5 flex items-center justify-between gap-3 px-5 lg:px-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <ChartLine size={15} />
          </span>
          Kurlar
        </p>
        <button
          type="button"
          onClick={() => sheet.show(chosen)}
          className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-surface-2"
        >
          <SlidersHorizontal size={13} /> Düzenle
        </button>
      </div>
      <div
        data-no-swipe
        className={cn(
          // scroll-px-5: kartlar yapışırken iç boşluk korunur (ilk kart nakit kartıyla aynı hizada).
          "no-scrollbar flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 pt-1 lg:grid lg:scroll-px-0 lg:overflow-visible lg:px-0",
          beside ? "lg:grid-cols-2" : "lg:grid-cols-4",
        )}
      >
        {codes.map((code) => (
          <RateCard key={code} rate={rateBy.get(code)!} />
        ))}
      </div>
      {sheet.item && (
        <WatchEditor
          initial={sheet.item}
          rateBy={rateBy}
          open={sheet.open}
          onClose={sheet.close}
          onExited={sheet.exited}
        />
      )}
    </nav>
  );
}

const GROUPS: { title: string; kinds: AssetKind[] }[] = [
  { title: "Döviz", kinds: ["currency"] },
  { title: "Altın ve gümüş", kinds: ["gold", "silver"] },
];

/** Ana ekranda gösterilecek kurları seçme: dokunma sırası kartların sırasıdır. */
function WatchEditor({
  initial,
  rateBy,
  open,
  onClose,
  onExited,
}: {
  initial: AssetCode[];
  rateBy: Map<AssetCode, Rate>;
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState<AssetCode[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (code: AssetCode) => {
    setError(null);
    haptic("select");
    if (picked.includes(code)) return setPicked(picked.filter((c) => c !== code));
    if (picked.length >= MAX_WATCH) return setError(`En fazla ${MAX_WATCH} kur seçebilirsin; önce birini çıkar.`);
    setPicked([...picked, code]);
  };

  const save = (codes: AssetCode[], msg: string) =>
    startTransition(async () => {
      const res = await saveWatchList(codes).catch(() => ({
        ok: false as const,
        error: "Bağlantı kurulamadı. Tekrar dene.",
      }));
      if (!res.ok) return setError(res.error);
      toast(msg);
      onClose();
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title="Ana ekrandaki kurlar"
      footer={
        <div className="flex gap-2 pb-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => save([], "Varsayılan kurlara dönüldü")}
            className="btn btn-ghost px-4 text-sm"
          >
            Varsayılan
          </button>
          <button
            type="button"
            disabled={pending || picked.length === 0}
            onClick={() => save(picked, "Kurlar güncellendi")}
            className="btn btn-primary flex-1"
          >
            {pending && <Spinner />} Kaydet ({picked.length}/{MAX_WATCH})
          </button>
        </div>
      }
    >
      <div className="space-y-5 pb-5">
        <p className="text-sm text-ink-2">Görmek istediklerine dokun; kartlar seçtiğin sırayla dizilir.</p>
        {GROUPS.map((g) => (
          <section key={g.title}>
            <p className="eyebrow mb-2">{g.title}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ASSETS.filter((a) => g.kinds.includes(a.kind)).map((a) => {
                const order = picked.indexOf(a.code);
                const on = order >= 0;
                const rate = rateBy.get(a.code);
                return (
                  <button
                    key={a.code}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={a.label}
                    onClick={() => toggle(a.code)}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition-all",
                      on ? cn(toneOf(a.code).card, "!border-ink/40") : "border-line hover:bg-surface-2",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br",
                        toneOf(a.code).icon,
                      )}
                    >
                      <AssetIcon code={a.code} size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{a.short}</span>
                      <span className="num block truncate text-[11px] text-ink-3">
                        {rate ? rateFmt.format(rate.rate) : "kur bekleniyor"}
                      </span>
                    </span>
                    {on && (
                      <span className="num absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-bg">
                        {order + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </Sheet>
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
