"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import type { Reminder } from "@/lib/reminders";
import { reminderTitle, whenLabel } from "@/lib/reminders";
import { dayMonthShort } from "@/lib/dates";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { useTxSheet } from "@/components/tx-sheet";
import { cn, Money } from "@/components/ui";
import { PayButton } from "./pay-button";

/** Defterin tepesinde: hatırlatma penceresine girmiş ödemeler. */
export function Reminders({ items }: { items: Reminder[] }) {
  const { currency, categoryById } = useApp();
  const { openEdit } = useTxSheet();
  if (items.length === 0) return null;
  const name = (id: string) => categoryById.get(id)?.name;

  return (
    <section
      aria-label="Yaklaşan ödeme hatırlatmaları"
      className="rise mt-4 overflow-hidden rounded-2xl border border-expense/30 bg-expense/[0.07]"
    >
      <p className="flex items-center gap-2 px-4 pt-3 text-xs font-medium text-expense">
        <Bell size={13} className="animate-[caret_2s_ease-in-out_3]" />
        {items.length === 1 ? "Yaklaşan ödeme" : `${items.length} ödeme yaklaşıyor`}
      </p>
      <ul className="px-2 pb-2 pt-1">
        {items.map((r) => {
          const cat = r.categoryId ? categoryById.get(r.categoryId) : undefined;
          const content = (
            <>
              <span aria-hidden className="text-base">{cat?.emoji ?? UNCATEGORIZED.emoji}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{reminderTitle(r, name)}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  r.daysLeft === 0 ? "bg-expense text-white" : "bg-surface text-ink-2",
                )}
                title={dayMonthShort(r.due)}
              >
                {whenLabel(r.daysLeft)}
              </span>
              <Money minor={-r.amount} currency={currency} sign className="w-28 shrink-0 text-right" />
            </>
          );
          const cls =
            "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-surface/70";
          return (
            <li key={`${r.sourceId}-${r.due}`} className="flex items-center">
              {r.transaction ? (
                <button type="button" className={cls} onClick={() => openEdit(r.transaction!)}>
                  {content}
                </button>
              ) : (
                <Link href="/duzenli" className={cls}>
                  {content}
                </Link>
              )}
              <PayButton
                target={
                  r.type === "once"
                    ? { type: "once", transactionId: r.sourceId }
                    : { type: "recurring", recurringId: r.sourceId, due: r.due }
                }
                label={reminderTitle(r, name)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
