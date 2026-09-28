"use client";

import { useState } from "react";
import type { EntryKind } from "@/lib/types";
import type { CategoryTotal } from "@/lib/ledger";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { cn, Money } from "@/components/ui";

const SHADES = [1, 0.74, 0.54, 0.4, 0.3, 0.22];
const TOP = SHADES.length;
const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });

/** "Nereye gitti?": tek şerit üzerinde oransal dağılım + bütçe cetvelleri. */
export function Breakdown({
  categories,
  activeKey,
  onSelect,
}: {
  categories: Record<EntryKind, CategoryTotal[]>;
  activeKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const { currency, categoryById } = useApp();
  const [kind, setKind] = useState<EntryKind>("expense");
  const rows = categories[kind];
  const total = rows.reduce((s, r) => s + r.total, 0);
  const fill = kind === "expense" ? "bg-expense" : "bg-income-fill";

  const head = rows.slice(0, TOP);
  const restTotal = rows.slice(TOP).reduce((s, r) => s + r.total, 0);

  return (
    <section className="card rise p-5 [animation-delay:120ms]" aria-label="Kategori dağılımı">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl tracking-tight">
          {kind === "expense" ? "Nereye gitti?" : "Nereden geldi?"}
        </h2>
        <div className="flex rounded-full bg-surface-2 p-0.5 text-xs">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "h-7 rounded-full px-3 font-medium transition-colors",
                kind === k ? "bg-surface text-ink shadow-sm" : "text-ink-3",
              )}
            >
              {k === "expense" ? "Gider" : "Gelir"}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-ink-3">Bu ay henüz {kind === "expense" ? "gider" : "gelir"} yok.</p>
      ) : (
        <>
          <div className="mt-5 flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden>
            {head.map((r, i) => (
              <span
                key={r.key}
                className={cn(fill, "h-full transition-opacity")}
                style={{
                  width: `${(r.total / total) * 100}%`,
                  opacity: activeKey && activeKey !== r.key ? 0.15 : SHADES[i],
                }}
              />
            ))}
            {restTotal > 0 && (
              <span className="h-full bg-ink-3 opacity-30" style={{ width: `${(restTotal / total) * 100}%` }} />
            )}
          </div>

          <ul className="mt-5 space-y-1">
            {rows.map((r, i) => {
              const cat = r.categoryId ? categoryById.get(r.categoryId) : undefined;
              const name = cat?.name ?? UNCATEGORIZED.name;
              const active = activeKey === r.key;
              const budget = kind === "expense" ? cat?.monthly_budget : null;
              return (
                <li key={r.key}>
                  <button
                    type="button"
                    onClick={() => onSelect(active ? null : r.key)}
                    aria-pressed={active}
                    className={cn(
                      "-mx-2 w-[calc(100%+1rem)] rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-2",
                      active && "bg-surface-2",
                    )}
                  >
                    <div className="flex items-baseline gap-2 text-sm">
                      <span
                        aria-hidden
                        className={cn("size-2 shrink-0 translate-y-[-1px] rounded-[2px]", i < TOP ? fill : "bg-ink-3")}
                        style={{ opacity: i < TOP ? SHADES[i] : 0.3 }}
                      />
                      <span aria-hidden>{cat?.emoji ?? UNCATEGORIZED.emoji}</span>
                      <span className="truncate font-medium">{name}</span>
                      <span className="num shrink-0 text-[11px] text-ink-3">×{r.count}</span>
                      <span className="leader" />
                      <Money minor={r.total} currency={currency} />
                      <span className="num w-9 shrink-0 text-right text-xs text-ink-3">
                        {pct.format(r.total / total)}
                      </span>
                    </div>
                    {budget ? <BudgetRuler spent={r.total} budget={budget} currency={currency} /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

const TICKS = 32;

/** Bütçe cetveli: 32 çentik, her biri bütçenin 1/32'si. Aşımda turuncuya döner. */
export function BudgetRuler({ spent, budget, currency }: { spent: number; budget: number; currency: string }) {
  const ratio = spent / budget;
  const filled = Math.min(TICKS, Math.round(ratio * TICKS));
  const over = ratio > 1;
  return (
    <div className="mt-2 pl-4">
      <div className="flex h-2.5 items-end justify-between" aria-hidden>
        {Array.from({ length: TICKS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "w-[2px] shrink-0 rounded-full",
              i < filled ? (over ? "bg-expense" : "bg-ink") : "bg-line",
              i % 8 === 7 ? "h-full" : "h-3/5",
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-ink-3">
        Bütçe <Money minor={budget} currency={currency} className="text-ink-2" /> ·{" "}
        {over ? (
          <span className="text-expense">
            <Money minor={spent - budget} currency={currency} /> aşıldı
          </span>
        ) : (
          <>
            kalan <Money minor={budget - spent} currency={currency} className="text-ink-2" />
          </>
        )}
      </p>
    </div>
  );
}
