"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { CategoryTotal } from "@/lib/ledger";
import { useApp } from "@/components/app-context";
import { AppIcon } from "@/components/category-icon";
import { cn, Money } from "@/components/ui";

/**
 * Bu ay bütçesinin %80'ini geçen kategoriler (bildirimleri kapalı olanlar da görsün diye).
 * Bütçe aşımı turuncu, yaklaşan sarı. Hiç yoksa çizilmez.
 */
export function BudgetAlerts({ categories }: { categories: CategoryTotal[] }) {
  const { categoryById, currency } = useApp();
  const items = categories
    .flatMap((c) => {
      const cat = c.categoryId ? categoryById.get(c.categoryId) : undefined;
      const budget = cat?.monthly_budget;
      if (!cat || !budget) return [];
      const ratio = c.total / budget;
      return ratio >= 0.8 ? [{ key: c.key, cat, budget, spent: c.total, ratio }] : [];
    })
    .sort((a, b) => b.ratio - a.ratio);
  if (items.length === 0) return null;

  return (
    <section aria-label="Bütçe uyarıları" className="rise mt-4 space-y-2">
      {items.map((i) => {
        const over = i.ratio >= 1;
        return (
          <Link
            key={i.key}
            href="/kategoriler"
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
              over
                ? "border-expense/35 bg-expense/[0.07] hover:bg-expense/[0.12]"
                : "border-amber-500/35 bg-amber-500/[0.08] hover:bg-amber-500/[0.14]",
            )}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl",
                over ? "bg-expense/15 text-expense" : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
              )}
            >
              {over ? <TriangleAlert size={17} /> : <AppIcon name={i.cat.emoji} size={17} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">
                {i.cat.name}: {over ? "bütçe aşıldı" : `bütçenin %${Math.floor(i.ratio * 100)}'i kullanıldı`}
              </span>
              <span className="mt-0.5 block text-xs text-ink-2">
                <Money minor={i.spent} currency={currency} /> / <Money minor={i.budget} currency={currency} />
                {over ? (
                  <>
                    {" · "}
                    <Money minor={i.spent - i.budget} currency={currency} className="font-medium text-expense" /> fazla
                  </>
                ) : (
                  <>
                    {" · kalan "}
                    <Money minor={i.budget - i.spent} currency={currency} className="font-medium" />
                  </>
                )}
              </span>
            </span>
            <span className="num shrink-0 text-sm font-semibold">%{Math.round(i.ratio * 100)}</span>
          </Link>
        );
      })}
    </section>
  );
}
