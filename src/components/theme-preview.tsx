import type { StylePref } from "@/components/theme";
import { cn } from "@/components/ui";

type Palette = { bg: string; surface: string; line: string; ink: string; ink3: string; income: string; expense: string };

/** globals.css'teki stil paletlerinin özeti (önizleme için; gerçek tema CSS değişkenlerinden gelir). */
const PALETTES: Record<StylePref, { light: Palette; dark: Palette }> = {
  classic: {
    light: { bg: "#e8e7e3", surface: "#f4f3f0", line: "#cbc9c2", ink: "#141414", ink3: "#8a898d", income: "#9ddb24", expense: "#d9431e" },
    dark: { bg: "#0c0c0d", surface: "#141416", line: "#28282c", ink: "#ecebe6", ink3: "#65656c", income: "#c3f150", expense: "#ff6a42" },
  },
  modern: {
    light: { bg: "#eef1f6", surface: "#ffffff", line: "#e2e8f0", ink: "#0f172a", ink3: "#94a3b8", income: "#22c55e", expense: "#ef4444" },
    dark: { bg: "#0b0f19", surface: "#121826", line: "#243045", ink: "#e8edf5", ink3: "#6b7690", income: "#34d399", expense: "#f87171" },
  },
  glass: {
    light: {
      bg: "linear-gradient(135deg,#c7d2fe,#f5d0fe 55%,#bae6fd)",
      surface: "rgb(255 255 255 / 0.62)",
      line: "rgb(255 255 255 / 0.75)",
      ink: "#1e1b4b",
      ink3: "#8582b0",
      income: "#34d399",
      expense: "#e11d48",
    },
    dark: {
      bg: "linear-gradient(135deg,#4338ca,#a21caf 55%,#0e7490)",
      surface: "rgb(255 255 255 / 0.1)",
      line: "rgb(255 255 255 / 0.14)",
      ink: "#f5f3ff",
      ink3: "#8d89b8",
      income: "#6ee7b7",
      expense: "#fb7185",
    },
  },
  minimal: {
    light: { bg: "#ffffff", surface: "#ffffff", line: "#e8e8e8", ink: "#111111", ink3: "#a3a3a3", income: "#4ade80", expense: "#ef4444" },
    dark: { bg: "#0a0a0a", surface: "#0f0f0f", line: "#262626", ink: "#f5f5f5", ink3: "#6b6b6b", income: "#4ade80", expense: "#ef4444" },
  },
};

/**
 * Küçük telefon ekranı: üst çubuk, "aylık net" kartı, gelir/gider çubukları ve alt sekmeler.
 * Seçilen stil + açık/koyu ile çizilir; böylece seçmeden önce nasıl görüneceği belli olur.
 */
export function ThemePreview({
  style,
  mode,
  className,
}: {
  style: StylePref;
  mode: "light" | "dark";
  className?: string;
}) {
  const p = PALETTES[style][mode];
  const rounded = style === "modern" ? 7 : style === "minimal" ? 4 : 6;
  const card = { background: p.surface, border: `1px solid ${p.line}`, borderRadius: rounded };
  return (
    <span aria-hidden className={cn("flex h-full w-full flex-col gap-1 overflow-hidden p-1.5", className)} style={{ background: p.bg }}>
      {/* üst çubuk */}
      <span className="flex items-center justify-between">
        <span className="flex items-center gap-0.5">
          <span className="block h-1.5 w-3 rounded-full" style={{ background: p.ink }} />
          <span className="block size-1 rounded-[1px]" style={{ background: p.income }} />
        </span>
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block size-1.5 rounded-full" style={{ background: p.ink3, opacity: 0.6 }} />
          ))}
        </span>
      </span>
      {/* aylık net kartı */}
      <span className="flex flex-col items-center gap-1 px-2 py-1.5" style={card}>
        <span className="block h-1 w-6 rounded-full" style={{ background: p.ink3 }} />
        <span className="block h-2 w-12 rounded-full" style={{ background: p.ink }} />
        <span className="flex w-full gap-1">
          <span className="block h-1 flex-[3] rounded-full" style={{ background: p.income }} />
          <span className="block h-1 flex-[2] rounded-full" style={{ background: p.expense }} />
        </span>
      </span>
      {/* iki satır */}
      {[p.income, p.expense].map((c, i) => (
        <span key={i} className="flex items-center gap-1 px-1.5 py-1" style={card}>
          <span className="block size-1.5 rounded-full" style={{ background: c }} />
          <span className="block h-1 flex-1 rounded-full" style={{ background: p.ink3, opacity: 0.7 }} />
          <span className="block h-1 w-3 rounded-full" style={{ background: p.ink }} />
        </span>
      ))}
      {/* alt sekmeler */}
      <span className="mt-auto flex justify-around pt-0.5" style={{ borderTop: `1px solid ${p.line}` }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="block size-1.5 rounded-[2px]" style={{ background: i === 0 ? p.ink : p.ink3 }} />
        ))}
      </span>
    </span>
  );
}
