"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { payRecurringNow, setTransactionPaid } from "@/lib/actions/entries";
import type { ActionResult } from "@/lib/action-utils";
import { useToast } from "@/components/toast";
import { cn, Spinner } from "@/components/ui";

export type PayTarget =
  | { type: "once"; transactionId: string }
  | { type: "recurring"; recurringId: string; due: string };

/** Yaklaşan bir ödemeyi "ödendi" olarak işaretleyen yuvarlak düğme (✓). */
export function PayButton({ target, label }: { target: PayTarget; label: string }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const pay = () =>
    startTransition(async () => {
      setDone(true);
      const res: ActionResult = await (target.type === "once"
        ? setTransactionPaid(target.transactionId, true)
        : payRecurringNow(target.recurringId, target.due)
      ).catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı. Tekrar dene." }));
      if (!res.ok) {
        setDone(false);
        toast(res.error, "error");
        return;
      }
      navigator.vibrate?.(10);
      toast(target.type === "recurring" ? `${label} ödendi · deftere yazıldı` : `${label} ödendi`);
    });

  return (
    <button
      type="button"
      onClick={pay}
      disabled={pending || done}
      role="checkbox"
      aria-checked={done}
      aria-label={`${label}: ödendi olarak işaretle`}
      title="Ödendi olarak işaretle"
      className="grid size-9 shrink-0 place-items-center"
    >
      <span
        className={cn(
          "grid size-6 place-items-center rounded-full border-2 transition-all duration-200",
          done ? "border-income-fill bg-income-fill text-on-fill" : "border-ink-3/60 hover:border-ink",
        )}
      >
        {pending && !done ? <Spinner className="size-3" /> : done ? <Check size={14} strokeWidth={3} /> : null}
      </span>
    </button>
  );
}
