"use client";

import { useFormStatus } from "react-dom";
import { moneyParts } from "@/lib/money";
import { useCountUp } from "@/components/use-count-up";

export const cn = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1 select-none", className)}>
      <span className="font-serif text-[1.6em] italic leading-none tracking-tight">Gri</span>
      <span className="inline-block size-[0.42em] translate-y-[-0.05em] rounded-[2px] bg-income-fill" />
    </span>
  );
}

/** Tutarı tipografik olarak parçalı gösterir: işaret · sembol · tam kısım · kuruş */
export function Money({
  minor,
  currency,
  sign = false,
  className,
  fracClassName = "opacity-45",
}: {
  minor: number;
  currency: string;
  sign?: boolean;
  className?: string;
  fracClassName?: string;
}) {
  const p = moneyParts(minor, currency);
  const prefix = p.negative ? "−" : sign && minor > 0 ? "+" : "";
  return (
    <span className={cn("num whitespace-nowrap", className)}>
      {prefix}
      {p.symbolFirst && <span className="mr-[0.08em]">{p.symbol}</span>}
      {p.int}
      <span className={fracClassName}>,{p.frac}</span>
      {!p.symbolFirst && <span className="ml-[0.2em]">{p.symbol}</span>}
    </span>
  );
}

/** Değer değişince sayarak geçen tutar. `id` aynı rakamı sayfalar arasında izlemek içindir. */
export function CountUpMoney({ minor, id, ...rest }: React.ComponentProps<typeof Money> & { id: string }) {
  return <Money minor={useCountUp(minor, id)} {...rest} />;
}

export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn("btn btn-primary w-full", className)}>
      {pending ? (
        <>
          <Spinner /> {pendingText ?? "Bekleyin…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Notice({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm leading-relaxed",
        tone === "error"
          ? "border-expense/40 bg-expense/10 text-expense"
          : "border-line bg-surface-2 text-ink",
      )}
    >
      {children}
    </p>
  );
}

/** Dekoratif barkod: giriş ekranında ayın ritmini ima eder. */
export function DecorBarcode({ className }: { className?: string }) {
  const bars = [
    0.3, 0.6, 0.2, 0.9, 0.4, 0.15, 0.7, 0.35, 0.55, 1, 0.25, 0.45, 0.8, 0.2, 0.6, 0.3, 0.5, 0.95,
    0.4, 0.2, 0.65, 0.3, 0.75, 0.45, 0.2, 0.85, 0.35, 0.55, 0.25, 0.7,
  ];
  return (
    <div aria-hidden className={cn("flex h-28 items-end gap-[3px]", className)}>
      {bars.map((h, i) => (
        <span
          key={i}
          className={cn("bar-grow flex-1 rounded-[2px]", i === 9 ? "bg-income-fill" : "bg-ink")}
          style={{ height: `${h * 100}%`, animationDelay: `${i * 22}ms`, opacity: i === 9 ? 1 : 0.85 }}
        />
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-ink" : "bg-surface-2 ring-1 ring-line",
      )}
    >
      <span
        className={cn(
          "absolute top-1 size-5 rounded-full transition-all duration-200",
          checked ? "left-6 bg-income-fill" : "left-1 bg-ink-3",
        )}
      />
    </button>
  );
}

/** Tutarı henüz belli olmayan kayıtlar için etiket ("tutar bekleniyor"). */
export function PendingAmount({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400",
        className,
      )}
      title="Tutar henüz girilmedi; belli olunca dokunup gir"
    >
      tutar bekleniyor
    </span>
  );
}
