"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui";

const KEY = "gri-report-items";
type Options = { income: boolean; expense: boolean };

/**
 * PDF'e madde madde gelir/gider listesi eklensin mi? Seçim bu cihazda hatırlanır.
 * Bölümler sayfada hep vardır; <html data-report-*="on"> yoksa CSS ile gizlenir (yazdırırken de).
 */
export function ReportOptions({ incomeCount, expenseCount }: { incomeCount: number; expenseCount: number }) {
  const [opts, setOpts] = useState<Options>({ income: false, expense: false });
  // Kayıtlı tercih okunmadan varsayılan (kapalı) yazılıp onu ezmesin.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Options> | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- kayıtlı tercih yalnızca istemcide okunabilir
      if (saved) setOpts({ income: saved.income === true, expense: saved.expense === true });
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const html = document.documentElement;
    html.dataset.reportIncome = opts.income ? "on" : "off";
    html.dataset.reportExpense = opts.expense ? "on" : "off";
    try {
      localStorage.setItem(KEY, JSON.stringify(opts));
    } catch {}
  }, [opts, ready]);

  const toggle = (k: keyof Options) => setOpts((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-ink-3">PDF&apos;e madde madde ekle:</span>
      <Chip on={opts.expense} onClick={() => toggle("expense")} label={`Giderler (${expenseCount})`} />
      <Chip on={opts.income} onClick={() => toggle("income")} label={`Gelirler (${incomeCount})`} />
    </div>
  );
}

function Chip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border px-3 font-medium transition-colors",
        on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:text-ink",
      )}
    >
      <span
        className={cn(
          "grid size-4 place-items-center rounded-[5px] border",
          on ? "border-bg/40 bg-bg/15" : "border-line",
        )}
      >
        {on && <Check size={11} strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}
