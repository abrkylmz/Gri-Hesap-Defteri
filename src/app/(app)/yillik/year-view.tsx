"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import type { YearSummary } from "@/lib/data";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { AppIcon } from "@/components/category-icon";
import { PageHeader } from "@/components/page-header";
import { cn, Money } from "@/components/ui";

const MONTH = new Intl.DateTimeFormat("tr-TR", { month: "short", timeZone: "UTC" });
const MONTH_LONG = new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "UTC" });
const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });
const mDate = (m: string) => Date.parse(`${m}-01T00:00:00Z`);

/** Yıllık özet: toplamlar, 12 aylık gelir/gider grafiği, öne çıkanlar ve kategori dağılımı. */
export function YearView({ summary, thisYear }: { summary: YearSummary; thisYear: number }) {
  const { currency, categoryById } = useApp();
  const [catKind, setCatKind] = useState<"expense" | "income">("expense");
  const [hover, setHover] = useState<number | null>(null);
  const { year, months } = summary;
  const income = months.reduce((s, m) => s + m.income, 0);
  const expense = months.reduce((s, m) => s + m.expense, 0);
  const net = income - expense;
  const rate = income > 0 ? net / income : null;
  const active = months.filter((m) => m.income > 0 || m.expense > 0);
  const avgExpense = active.length ? expense / active.length : 0;
  const best = [...active].sort((a, b) => b.income - b.expense - (a.income - a.expense))[0];
  const heaviest = [...active].sort((a, b) => b.expense - a.expense)[0];
  const max = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));
  const cats = summary.categories.filter((c) => c.kind === catKind);
  const catTotal = cats.reduce((s, c) => s + c.total, 0);
  const shown = hover !== null ? months[hover] : null;

  return (
    <div className="mx-auto max-w-4xl px-5 pb-10 lg:px-10">
      <PageHeader
        eyebrow="Rapor"
        title={`${year} özeti`}
        action={
          <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
            <YearLink year={year - 1} disabled={year - 1 < summary.firstYear} dir="prev" />
            <span className="num px-2 text-sm font-semibold">{year}</span>
            <YearLink year={year + 1} disabled={year + 1 > thisYear} dir="next" />
          </div>
        }
      >
        {summary.count > 0 ? `${summary.count.toLocaleString("tr-TR")} kayıt` : "Bu yıl için kayıt yok."}
        {year === thisYear && summary.count > 0 && " · yıl devam ediyor"}
      </PageHeader>

      {/* Toplamlar */}
      <section className="rise mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Toplamlar">
        <Kpi label="Gelir">
          <Money minor={income} currency={currency} fracClassName="opacity-40" className="text-income" />
        </Kpi>
        <Kpi label="Gider">
          <Money minor={expense} currency={currency} fracClassName="opacity-40" />
        </Kpi>
        <Kpi label={net >= 0 ? "Birikim" : "Açık"}>
          <Money
            minor={net}
            currency={currency}
            sign
            fracClassName="opacity-40"
            className={net >= 0 ? "text-income" : "text-expense"}
          />
        </Kpi>
        <Kpi label="Tasarruf oranı">
          <span className={cn("num", rate !== null && rate < 0 && "text-expense")}>
            {rate === null ? "—" : pct.format(rate)}
          </span>
        </Kpi>
      </section>

      {/* 12 ay: gelir ve gider yan yana */}
      <section className="card rise mt-4 p-4 sm:p-5" aria-label="Aylara göre">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">Aylara göre</p>
          <p className="text-xs text-ink-3">
            {shown ? (
              <>
                <span className="font-semibold capitalize text-ink">{MONTH_LONG.format(mDate(shown.month))}</span> ·
                gelir <Money minor={shown.income} currency={currency} /> · gider{" "}
                <Money minor={shown.expense} currency={currency} />
              </>
            ) : (
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-sm bg-income-fill" /> gelir
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-sm bg-ink/70" /> gider
                </span>
              </span>
            )}
          </p>
        </div>
        <div className="mt-4 grid h-40 grid-cols-12 items-end gap-1.5" onPointerLeave={() => setHover(null)}>
          {months.map((m, i) => (
            <div
              key={m.month}
              onPointerEnter={() => setHover(i)}
              className={cn(
                "flex h-full items-end justify-center gap-[2px] transition-opacity",
                hover !== null && hover !== i && "opacity-40",
              )}
            >
              <span
                className="w-1/2 max-w-3 rounded-t-[3px] bg-income-fill"
                style={{ height: `${(m.income / max) * 100}%` }}
              />
              <span
                className="w-1/2 max-w-3 rounded-t-[3px] bg-ink/70"
                style={{ height: `${(m.expense / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-12 gap-1.5 text-center text-[10px] text-ink-3">
          {months.map((m) => (
            <span key={m.month} className="truncate capitalize">
              {MONTH.format(mDate(m.month)).replace(".", "")}
            </span>
          ))}
        </div>
      </section>

      {/* Öne çıkanlar */}
      {active.length > 0 && (
        <section className="rise mt-4 grid gap-3 sm:grid-cols-3" aria-label="Öne çıkanlar">
          {best && (
            <Highlight icon={<Sparkles size={15} />} tone="income" label="En iyi ay">
              <span className="capitalize">{MONTH_LONG.format(mDate(best.month))}</span>
              <span className="block text-xs font-normal text-ink-3">
                <Money minor={best.income - best.expense} currency={currency} sign /> net
              </span>
            </Highlight>
          )}
          {heaviest && (
            <Highlight icon={<TrendingUp size={15} />} tone="expense" label="En yüksek harcama">
              <span className="capitalize">{MONTH_LONG.format(mDate(heaviest.month))}</span>
              <span className="block text-xs font-normal text-ink-3">
                <Money minor={heaviest.expense} currency={currency} />
              </span>
            </Highlight>
          )}
          <Highlight icon={<TrendingDown size={15} />} tone="ink" label="Aylık ortalama gider">
            <Money minor={Math.round(avgExpense)} currency={currency} />
            <span className="block text-xs font-normal text-ink-3">{active.length} aylık veri</span>
          </Highlight>
        </section>
      )}

      {/* Kategoriler */}
      <section className="card rise mt-4 p-4 sm:p-5" aria-label="Kategoriler">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Kategoriler</p>
          <div role="radiogroup" aria-label="Tür" className="flex rounded-full bg-surface-2 p-0.5">
            {(
              [
                ["expense", "Gider"],
                ["income", "Gelir"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={catKind === k}
                onClick={() => setCatKind(k)}
                className={cn(
                  "h-7 rounded-full px-3 text-xs font-medium",
                  catKind === k ? "bg-surface text-ink shadow-sm" : "text-ink-3",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {cats.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">Bu yıl {catKind === "expense" ? "gider" : "gelir"} yok.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {cats.slice(0, 12).map((c) => {
              const cat = c.categoryId ? categoryById.get(c.categoryId) : undefined;
              const share = catTotal ? c.total / catTotal : 0;
              return (
                <li key={`${c.kind}:${c.categoryId}`} className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
                    <AppIcon name={cat?.emoji} size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{cat?.name ?? UNCATEGORIZED.name}</span>
                      <Money minor={c.total} currency={currency} className="shrink-0 whitespace-nowrap" />
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            catKind === "income" ? "bg-income-fill" : "bg-expense/80",
                          )}
                          style={{ width: `${share * 100}%` }}
                        />
                      </span>
                      <span className="num shrink-0 whitespace-nowrap text-right text-[11px] text-ink-3">
                        %{Math.round(share * 100)} · {c.count} kayıt
                      </span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function YearLink({ year, disabled, dir }: { year: number; disabled: boolean; dir: "prev" | "next" }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  const cls = "grid size-8 place-items-center rounded-full";
  return disabled ? (
    <span className={cn(cls, "text-ink-3 opacity-40")} aria-hidden>
      <Icon size={16} />
    </span>
  ) : (
    <Link href={`/yillik?yil=${year}`} className={cn(cls, "hover:bg-surface-2")} aria-label={`${year} özeti`}>
      <Icon size={16} />
    </Link>
  );
}

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold leading-tight tracking-tight sm:text-xl">{children}</p>
    </div>
  );
}

function Highlight({
  icon,
  tone,
  label,
  children,
}: {
  icon: React.ReactNode;
  tone: "income" | "expense" | "ink";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          tone === "income"
            ? "bg-income-fill/20 text-income"
            : tone === "expense"
              ? "bg-expense/12 text-expense"
              : "bg-surface-2 text-ink-2",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-ink-3">{label}</span>
        <span className="block text-sm font-semibold">{children}</span>
      </span>
    </div>
  );
}
