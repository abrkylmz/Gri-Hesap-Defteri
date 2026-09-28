"use client";

import Link from "next/link";
import { Repeat } from "lucide-react";
import type { upcomingRecurring } from "@/lib/ledger";
import { dayMonthShort } from "@/lib/dates";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { cn, Money } from "@/components/ui";

type Item = ReturnType<typeof upcomingRecurring>[number];

/** Bu ay henüz işlenmemiş düzenli kayıtlar ve beklenen ay sonu neti. */
export function Upcoming({ items, net }: { items: Item[]; net: number }) {
  const { currency, categoryById } = useApp();
  if (items.length === 0) return null;
  const expected = items.reduce((s, r) => s + (r.kind === "income" ? r.amount : -r.amount), net);

  return (
    <section className="card rise overflow-hidden [animation-delay:90ms]" aria-label="Yaklaşan düzenli kayıtlar">
      <div className="flex items-center justify-between px-5 pt-5">
        <p className="eyebrow flex items-center gap-1.5">
          <Repeat size={12} /> Bu ay bekleyen
        </p>
        <Link href="/duzenli" className="text-xs text-ink-3 hover:text-ink">
          Yönet →
        </Link>
      </div>
      <ul className="mt-3 px-5">
        {items.map((r) => {
          const cat = r.category_id ? categoryById.get(r.category_id) : undefined;
          return (
            <li key={r.id} className="flex items-baseline gap-2 py-1.5 text-sm">
              <span className="num w-12 shrink-0 text-xs text-ink-3">{dayMonthShort(r.date)}</span>
              <span aria-hidden>{cat?.emoji ?? UNCATEGORIZED.emoji}</span>
              <span className="truncate">{r.note || cat?.name || UNCATEGORIZED.name}</span>
              <span className="leader" />
              <Money
                minor={r.kind === "income" ? r.amount : -r.amount}
                currency={currency}
                sign
                className={cn(r.kind === "income" && "text-income")}
              />
            </li>
          );
        })}
      </ul>
      <div className="perforation mt-3" />
      <div className="flex items-baseline justify-between bg-surface-2 px-5 pb-4 pt-2 text-sm">
        <span className="text-ink-2">Beklenen ay sonu net</span>
        <Money
          minor={expected}
          currency={currency}
          sign
          className={cn("text-base font-medium", expected < 0 && "text-expense")}
        />
      </div>
    </section>
  );
}
