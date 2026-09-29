"use client";

import { Lightbulb, Plus, Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { TransactionRow } from "@/lib/types";
import { categoryKey, groupByDate, normalize } from "@/lib/ledger";
import { dayMonth, dayOf, weekdayName } from "@/lib/dates";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { useTxSheet } from "@/components/tx-sheet";
import { useDeleteWithUndo } from "@/components/use-delete-with-undo";
import { LedgerRow } from "./ledger-row";
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
  const [swipedId, setSwipedId] = useState<string | null>(null);
  // Silinenler sunucu yanıtı beklenmeden listeden kalkar; hata olursa geri döner.
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const deleteWithUndo = useDeleteWithUndo();

  const remove = async (tx: TransactionRow) => {
    setSwipedId(null);
    setRemoved((r) => new Set(r).add(tx.id));
    const ok = await deleteWithUndo(tx);
    // Başarılıysa da işareti kaldır: "Geri al" ile aynı id geri gelebilir.
    setRemoved((r) => {
      const next = new Set(r);
      next.delete(tx.id);
      return next;
    });
    return ok;
  };

  const filtered = useMemo(() => {
    const q = normalize(deferredQuery.trim());
    return transactions.filter((t) => {
      if (removed.has(t.id)) return false;
      if (kind !== "all" && t.kind !== kind) return false;
      if (day && t.occurred_on !== day) return false;
      if (catKey && categoryKey(t.kind, t.category_id) !== catKey) return false;
      if (q) {
        const cat = t.category_id ? categoryById.get(t.category_id)?.name : UNCATEGORIZED.name;
        if (!normalize(`${t.note ?? ""} ${cat ?? ""}`).includes(q)) return false;
      }
      return true;
    });
  }, [transactions, removed, kind, day, catKey, deferredQuery, categoryById]);

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

      {groups.length > 0 && <UsageHint />}

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
                  <LedgerRow
                    key={t.id}
                    tx={t}
                    swiped={swipedId === t.id}
                    onSwipe={(open) => setSwipedId(open ? t.id : null)}
                    onEdit={() => openEdit(t)}
                    onDelete={() => remove(t)}
                    onRemind={() => openEdit(t, { remind: true })}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
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

const HINT_KEY = "gri:hint:edit-delete";

/** Düzenle/sil yollarını bir kez anlatan, kapatılabilir ipucu. */
function UsageHint() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(HINT_KEY)) return;
    } catch {
      return;
    }
    const touch = window.matchMedia("(pointer: coarse)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage ve işaretçi türü yalnızca istemcide bilinir
    setText(
      touch
        ? "Bir kayda dokunarak düzenleyebilir, sola kaydırarak silebilirsin."
        : "Kaydın üzerine gelince düzenle ve sil simgeleri çıkar; tıklayarak da düzenleyebilirsin.",
    );
  }, []);

  if (!text) return null;
  const close = () => {
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* yok say */
    }
    setText(null);
  };

  return (
    <div className="rise mt-3 flex items-start gap-3 rounded-2xl bg-surface-2/70 px-4 py-3 text-sm text-ink-2">
      <Lightbulb size={16} className="mt-0.5 shrink-0 text-ink" />
      <p className="flex-1">{text}</p>
      <button type="button" onClick={close} aria-label="İpucunu kapat" className="text-ink-3 hover:text-ink">
        <X size={16} />
      </button>
    </div>
  );
}
