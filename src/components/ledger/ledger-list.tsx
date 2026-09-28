"use client";

import { Plus, Repeat, Search, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import type { TransactionRow } from "@/lib/database.types";
import { categoryKey, groupByDate, normalize } from "@/lib/ledger";
import { dayMonth, dayOf, weekdayName } from "@/lib/dates";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { useTxSheet } from "@/components/tx-sheet";
import { cn, Money } from "@/components/ui";

type KindFilter = "all" | "income" | "expense";

export function LedgerList({
  transactions,
  day,
  catKey,
  onClearDay,
  onClearCategory,
}: {
  transactions: TransactionRow[];
  day: string | null;
  catKey: string | null;
  onClearDay: () => void;
  onClearCategory: () => void;
}) {
  const { currency, categoryById } = useApp();
  const { openEdit, openNew } = useTxSheet();
  const [kind, setKind] = useState<KindFilter>("all");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = normalize(deferredQuery.trim());
    return transactions.filter((t) => {
      if (kind !== "all" && t.kind !== kind) return false;
      if (day && t.occurred_on !== day) return false;
      if (catKey && categoryKey(t.kind, t.category_id) !== catKey) return false;
      if (q) {
        const cat = t.category_id ? categoryById.get(t.category_id)?.name : UNCATEGORIZED.name;
        if (!normalize(`${t.note ?? ""} ${cat ?? ""}`).includes(q)) return false;
      }
      return true;
    });
  }, [transactions, kind, day, catKey, deferredQuery, categoryById]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);
  const catLabel = (() => {
    if (!catKey) return null;
    const id = catKey.split(":")[1];
    const cat = id && id !== "none" ? categoryById.get(id) : undefined;
    return cat ? `${cat.emoji} ${cat.name}` : UNCATEGORIZED.name;
  })();

  return (
    <section id="defter" aria-label="Defter" className="scroll-mt-4">
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-3xl tracking-tight">Defter</h2>
        <span className="num mt-1 text-xs text-ink-3">{filtered.length} kayıt</span>
        <button
          type="button"
          onClick={() => {
            setSearching((s) => !s);
            setQuery("");
          }}
          aria-pressed={searching}
          aria-label="Ara"
          className={cn(
            "ml-auto grid size-9 place-items-center rounded-full transition-colors",
            searching ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2",
          )}
        >
          {searching ? <X size={16} /> : <Search size={16} />}
        </button>
      </div>

      {searching && (
        <input
          autoFocus
          type="search"
          className="input rise mt-3"
          placeholder="Açıklama ya da kategori ara…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      <div className="no-scrollbar -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
        {(
          [
            ["all", "Tümü"],
            ["expense", "Giderler"],
            ["income", "Gelirler"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {label}
          </button>
        ))}
        {day && (
          <button type="button" className="chip border-ink text-ink" onClick={onClearDay}>
            {dayMonth(day)} <X size={13} />
          </button>
        )}
        {catLabel && (
          <button type="button" className="chip border-ink text-ink" onClick={onClearCategory}>
            {catLabel} <X size={13} />
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyLedger filtered={transactions.length > 0} onAdd={() => openNew({ date: day ?? undefined })} />
      ) : (
        <div className="mt-4">
          {groups.map((g) => (
            <div key={g.date} className="border-t border-line py-3 first:border-t-0">
              <div className="flex items-baseline gap-3 pb-1">
                <span className="num w-8 text-2xl font-medium leading-none">{dayOf(g.date)}</span>
                <span className="text-xs capitalize text-ink-3">{weekdayName(g.date)}</span>
                {g.items.length > 1 && (
                  <Money
                    minor={g.net}
                    currency={currency}
                    sign
                    className={cn("ml-auto text-xs", g.net < 0 ? "text-ink-3" : "text-income")}
                  />
                )}
              </div>
              <ul>
                {g.items.map((t) => (
                  <Row key={t.id} tx={t} onOpen={() => openEdit(t)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Row({ tx, onOpen }: { tx: TransactionRow; onOpen: () => void }) {
  const { currency, categoryById } = useApp();
  const cat = tx.category_id ? categoryById.get(tx.category_id) : undefined;
  const title = tx.note || cat?.name || UNCATEGORIZED.name;
  const income = tx.kind === "income";

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-2 active:bg-surface-2"
      >
        <span
          aria-hidden
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl text-lg",
            income ? "bg-income-fill/20" : "bg-surface-2",
          )}
        >
          {cat?.emoji ?? UNCATEGORIZED.emoji}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-[15px] font-medium">{title}</span>
            <span className="leader" />
            <Money
              minor={income ? tx.amount : -tx.amount}
              currency={currency}
              sign
              className={cn("shrink-0 text-[15px]", income && "text-income")}
            />
          </span>
          {(tx.note || tx.recurring_id) && (
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
              {tx.note && <span className="truncate">{cat?.name ?? UNCATEGORIZED.name}</span>}
              {tx.recurring_id && (
                <span className="flex items-center gap-1">
                  <Repeat size={11} /> düzenli
                </span>
              )}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function EmptyLedger({ filtered, onAdd }: { filtered: boolean; onAdd: () => void }) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
      <div aria-hidden className="mx-auto flex h-10 w-32 items-end justify-center gap-[3px] opacity-40">
        {[3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3].map((h, i) => (
          <span key={i} className="w-[3px] rounded-[1px] bg-ink-3" style={{ height: h }} />
        ))}
      </div>
      <p className="mt-5 font-serif text-2xl">{filtered ? "Eşleşen kayıt yok." : "Sayfa henüz boş."}</p>
      <p className="mt-1 text-sm text-ink-2">
        {filtered ? "Filtreleri değiştirmeyi dene." : "İlk kaydı yaz; barkodun ilk çizgisi belirsin."}
      </p>
      {!filtered && (
        <button type="button" onClick={onAdd} className="btn btn-primary mt-6">
          <Plus size={18} /> İlk kaydı ekle
        </button>
      )}
    </div>
  );
}
