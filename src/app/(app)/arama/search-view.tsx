"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dayMonth, monthLabel, monthOf } from "@/lib/dates";
import type { TransactionRow } from "@/lib/types";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { AppIcon } from "@/components/category-icon";
import { PageHeader } from "@/components/page-header";
import { DateField } from "@/components/date-picker";
import { useTxSheet } from "@/components/tx-sheet";
import { cn, Money, PendingAmount, Spinner } from "@/components/ui";

type Form = {
  q: string;
  tur: "all" | "income" | "expense";
  kat: string;
  bas: string;
  bit: string;
  min: string;
  max: string;
};

/** Tüm geçmişte arama: metin + tür, kategori, tarih ve tutar aralığı. Filtreler adreste tutulur. */
export function SearchView({ initial, results }: { initial: Form; results: TransactionRow[] | null }) {
  const router = useRouter();
  const { currency, categories, categoryById } = useApp();
  const { openEdit } = useTxSheet();
  const [f, setF] = useState(initial);
  const [more, setMore] = useState(Boolean(initial.kat || initial.bas || initial.bit || initial.min || initial.max));
  const [pending, start] = useTransition();
  const set = (patch: Partial<Form>) => setF((x) => ({ ...x, ...patch }));

  const submit = (next: Form = f) => {
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.tur !== "all") params.set("tur", next.tur);
    for (const k of ["kat", "bas", "bit", "min", "max"] as const) if (next[k]) params.set(k, next[k]);
    start(() => router.replace(`/arama${params.size ? `?${params}` : ""}`, { scroll: false }));
  };
  const reset = () => {
    const empty: Form = { q: "", tur: "all", kat: "", bas: "", bit: "", min: "", max: "" };
    setF(empty);
    submit(empty);
  };

  // Aylara göre grupla (en yeni ay üstte), her ayın neti
  const groups: { month: string; items: TransactionRow[]; net: number }[] = [];
  for (const t of results ?? []) {
    const m = monthOf(t.occurred_on);
    let g = groups.at(-1);
    if (!g || g.month !== m) groups.push((g = { month: m, items: [], net: 0 }));
    g.items.push(t);
    if (t.amount !== null) g.net += t.kind === "income" ? t.amount : -t.amount;
  }
  const income = (results ?? []).reduce((s, t) => s + (t.kind === "income" ? (t.amount ?? 0) : 0), 0);
  const expense = (results ?? []).reduce((s, t) => s + (t.kind === "expense" ? (t.amount ?? 0) : 0), 0);
  const kindCats = categories.filter((c) => f.tur === "all" || c.kind === f.tur);

  return (
    <div className="mx-auto max-w-3xl px-5 pb-10 lg:px-10">
      <PageHeader eyebrow="Defter" title="Arama">
        Tüm aylarda açıklama ya da kategoriye göre ara; tarih ve tutarla daralt.
      </PageHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="rise mt-6 space-y-3"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              autoFocus={!initial.q}
              value={f.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="ör. market, kira, Migros…"
              aria-label="Ara"
              className="input pl-11"
              enterKeyHint="search"
            />
          </div>
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            aria-expanded={more}
            aria-label="Filtreler"
            className={cn("btn h-12 shrink-0 px-4", more ? "btn-primary" : "btn-ghost")}
          >
            <SlidersHorizontal size={17} />
          </button>
          <button type="submit" className="btn btn-primary h-12 shrink-0 px-5" disabled={pending}>
            {pending ? <Spinner /> : "Ara"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Tümü"],
              ["expense", "Giderler"],
              ["income", "Gelirler"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className="chip"
              aria-pressed={f.tur === k}
              onClick={() => {
                const next = { ...f, tur: k, kat: "" };
                setF(next);
                submit(next);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {more && (
          <div className="rise grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-3">
            <label className="col-span-2 sm:col-span-1">
              <span className="text-xs text-ink-3">Kategori</span>
              <select className="input mt-1 h-11" value={f.kat} onChange={(e) => set({ kat: e.target.value })}>
                <option value="">Tümü</option>
                {kindCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {f.tur === "all" ? (c.kind === "income" ? " (gelir)" : "") : ""}
                  </option>
                ))}
              </select>
            </label>
            {/* Uygulamanın kendi tarih seçicisi (yerel tarih kutusu mobilde takılıyordu) */}
            <div>
              <span className="text-xs text-ink-3">Başlangıç</span>
              <div className="mt-1">
                <DateField value={f.bas} onChange={(bas) => set({ bas })} ariaLabel="Başlangıç tarihi" placeholder="Seç" />
              </div>
            </div>
            <div>
              <span className="text-xs text-ink-3">Bitiş</span>
              <div className="mt-1">
                <DateField value={f.bit} onChange={(bit) => set({ bit })} ariaLabel="Bitiş tarihi" placeholder="Seç" />
              </div>
            </div>
            <label>
              <span className="text-xs text-ink-3">En az tutar</span>
              <input
                inputMode="decimal"
                className="input num mt-1 h-11"
                value={f.min}
                onChange={(e) => set({ min: e.target.value })}
                placeholder="0"
              />
            </label>
            <label>
              <span className="text-xs text-ink-3">En çok tutar</span>
              <input
                inputMode="decimal"
                className="input num mt-1 h-11"
                value={f.max}
                onChange={(e) => set({ max: e.target.value })}
                placeholder="∞"
              />
            </label>
            <div className="col-span-2 flex justify-end gap-2 sm:col-span-3">
              <button type="button" className="btn btn-ghost h-10 text-sm" onClick={reset}>
                <X size={15} /> Temizle
              </button>
              <button type="submit" className="btn btn-primary h-10 text-sm">
                Uygula
              </button>
            </div>
          </div>
        )}
      </form>

      {results === null ? (
        <p className="mt-10 rounded-3xl border border-dashed border-line p-8 text-center text-sm text-ink-2">
          Bir kelime yaz ya da filtre seç. Arama tüm aylardaki kayıtlarında yapılır.
        </p>
      ) : results.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-line p-8 text-center text-sm text-ink-2">
          Sonuç yok. Daha kısa bir kelime dene ya da filtreleri gevşet.
        </p>
      ) : (
        <>
          <section className="rise mt-6 grid grid-cols-3 gap-2" aria-label="Sonuç özeti">
            <Stat label="Sonuç">
              <span className="num">
                {results.length}
                {results.length === 500 && "+"}
              </span>
            </Stat>
            <Stat label="Gelir">
              <Money minor={income} currency={currency} className="text-income" />
            </Stat>
            <Stat label="Gider">
              <Money minor={expense} currency={currency} />
            </Stat>
          </section>
          {results.length === 500 && (
            <p className="mt-2 text-xs text-ink-3">İlk 500 sonuç gösteriliyor; aramayı daraltmak için filtre ekle.</p>
          )}
          <div className="mt-6 space-y-6">
            {groups.map((g) => (
              <section key={g.month} aria-label={monthLabel(g.month)}>
                <div className="mb-2 flex items-baseline justify-between border-b border-line pb-2">
                  <h2 className="text-sm font-semibold capitalize">{monthLabel(g.month)}</h2>
                  <Money
                    minor={g.net}
                    currency={currency}
                    sign
                    className={cn("text-xs", g.net >= 0 && "text-income")}
                  />
                </div>
                <ul>
                  {g.items.map((t) => {
                    const cat = t.category_id ? categoryById.get(t.category_id) : undefined;
                    const income = t.kind === "income";
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-2"
                        >
                          <span
                            className={cn(
                              "grid size-9 shrink-0 place-items-center rounded-xl",
                              income ? "bg-income-fill/20 text-income" : "bg-surface-2 text-ink-2",
                            )}
                          >
                            <AppIcon name={cat?.emoji} size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 break-words text-sm font-medium leading-snug">
                              {t.note || cat?.name || UNCATEGORIZED.name}
                            </span>
                            <span className="block text-xs text-ink-3">
                              {dayMonth(t.occurred_on)}
                              {t.note && ` · ${cat?.name ?? UNCATEGORIZED.name}`}
                            </span>
                          </span>
                          {t.amount === null ? (
                            <PendingAmount />
                          ) : (
                            <Money
                              minor={income ? t.amount : -t.amount}
                              currency={currency}
                              sign
                              className={cn("shrink-0 whitespace-nowrap text-sm", income && "text-income")}
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2/60 px-3 py-3">
      <p className="text-[11px] font-medium text-ink-3">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{children}</p>
    </div>
  );
}
