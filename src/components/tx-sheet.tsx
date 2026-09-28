"use client";

import { Calendar, Check, Delete, Repeat } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { deleteTransaction, saveTransaction } from "@/lib/actions/entries";
import type { EntryKind, TransactionRow } from "@/lib/types";
import { dayMonthShort, shiftDate } from "@/lib/dates";
import { displayAmount, KEYS, pressKey, type Key } from "@/lib/keypad";
import { formatMoney, minorToInput, toMinor } from "@/lib/money";
import { DEFAULT_REMIND_DAYS } from "@/lib/validation";
import { useApp } from "@/components/app-context";
import { RemindPicker } from "@/components/remind-picker";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Spinner } from "@/components/ui";

type Draft = {
  id?: string;
  kind: EntryKind;
  amount: string;
  categoryId: string | null;
  note: string;
  date: string;
  fromRecurring: boolean;
  /** undefined = kullanıcı henüz seçmedi (ileri tarihli giderde varsayılan uygulanır) */
  remindDays: number | null | undefined;
};

type TxSheetApi = {
  openNew: (opts?: { kind?: EntryKind; date?: string }) => void;
  openEdit: (tx: TransactionRow) => void;
  /** Sayfanın bağlamına göre yeni kayıtlar için varsayılan tarih (ör. görüntülenen geçmiş ay). */
  setDefaultDate: (date: string | null) => void;
};

const TxSheetContext = createContext<TxSheetApi | null>(null);
const LAST_CATEGORY_KEY = "gri:last-category:";

function lastCategory(kind: EntryKind): string | null {
  try {
    return localStorage.getItem(LAST_CATEGORY_KEY + kind);
  } catch {
    return null;
  }
}

export function TxSheetProvider({ children }: { children: React.ReactNode }) {
  const { today, categoryById } = useApp();
  const sheet = useSheetState<Draft>();
  const defaultDate = useRef<string | null>(null);
  const { show } = sheet;

  const api = useMemo<TxSheetApi>(
    () => ({
      openNew: ({ kind = "expense", date } = {}) => {
        const remembered = lastCategory(kind);
        show({
          kind,
          amount: "",
          categoryId: remembered && categoryById.has(remembered) ? remembered : null,
          note: "",
          date: date ?? defaultDate.current ?? today,
          fromRecurring: false,
          remindDays: undefined,
        });
      },
      openEdit: (tx) =>
        show({
          id: tx.id,
          kind: tx.kind,
          amount: minorToInput(tx.amount),
          categoryId: tx.category_id,
          note: tx.note ?? "",
          date: tx.occurred_on,
          fromRecurring: Boolean(tx.recurring_id),
          remindDays: tx.remind_days,
        }),
      setDefaultDate: (date) => {
        defaultDate.current = date;
      },
    }),
    [show, today, categoryById],
  );

  return (
    <TxSheetContext.Provider value={api}>
      {children}
      {sheet.item && (
        <TxEditor
          initial={sheet.item}
          open={sheet.open}
          onClose={sheet.close}
          onExited={sheet.exited}
        />
      )}
    </TxSheetContext.Provider>
  );
}

export function useTxSheet() {
  const ctx = useContext(TxSheetContext);
  if (!ctx) throw new Error("useTxSheet, TxSheetProvider içinde kullanılmalı");
  return ctx;
}

// ─── Düzenleyici ───────────────────────────────────────────────────────

function TxEditor({
  initial,
  open,
  onClose,
  onExited,
}: {
  initial: Draft;
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}) {
  const { categories, currency, today } = useApp();
  const toast = useToast();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(initial.id);
  const minor = toMinor(draft.amount);
  const isExpense = draft.kind === "expense";
  // İleri tarihli giderler "planlı ödeme"dir ve hatırlatılabilir.
  const canRemind = isExpense && draft.date > today && !draft.fromRecurring;
  const effectiveRemind = draft.remindDays === undefined ? DEFAULT_REMIND_DAYS : draft.remindDays;

  const kindCategories = useMemo(
    () => categories.filter((c) => c.kind === draft.kind),
    [categories, draft.kind],
  );

  const update = (patch: Partial<Draft>) => {
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const setKind = (kind: EntryKind) => {
    if (kind === draft.kind) return;
    const remembered = lastCategory(kind);
    update({
      kind,
      categoryId:
        remembered && categories.some((c) => c.id === remembered && c.kind === kind)
          ? remembered
          : null,
    });
  };

  const press = useCallback((key: Key) => {
    setError(null);
    setDraft((d) => ({ ...d, amount: pressKey(d.amount, key) }));
  }, []);

  const save = useCallback(() => {
    if (pending) return;
    if (!minor) {
      setError("Önce bir tutar gir.");
      return;
    }
    startTransition(async () => {
      const res = await saveTransaction({
        id: draft.id,
        kind: draft.kind,
        amount: minor,
        categoryId: draft.categoryId,
        note: draft.note,
        occurredOn: draft.date,
        remindDays: canRemind ? effectiveRemind : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      try {
        if (draft.categoryId) localStorage.setItem(LAST_CATEGORY_KEY + draft.kind, draft.categoryId);
      } catch {
        /* yok say */
      }
      const signed = draft.kind === "expense" ? -minor : minor;
      toast(`${isEdit ? "Güncellendi" : "Deftere yazıldı"} · ${formatMoney(signed, currency, { sign: true })}`);
      onClose();
    });
  }, [pending, minor, draft, canRemind, effectiveRemind, isEdit, currency, toast, onClose]);

  const remove = () => {
    if (!draft.id) return;
    const id = draft.id;
    startTransition(async () => {
      const res = await deleteTransaction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast("Kayıt silindi");
      onClose();
    });
  };

  // Fiziksel klavye: rakamlar, virgül/nokta, geri silme, Enter.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      const typing = target.closest("input, textarea, select");
      if (e.key === "Enter" && (!typing || target.getAttribute("name") === "note")) {
        e.preventDefault();
        save();
        return;
      }
      if (typing) return;
      if (/^\d$/.test(e.key)) press(e.key as Key);
      else if (e.key === "," || e.key === ".") press(",");
      else if (e.key === "Backspace") press("back");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, press, save]);

  // Geri silmeye uzun basınca tümünü temizle
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startHold = () => {
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      navigator.vibrate?.(12);
      update({ amount: "" });
    }, 450);
  };
  const endHold = (tap: boolean) => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      if (tap) press("back");
    }
  };

  const { int, frac } = displayAmount(draft.amount);
  const yesterday = shiftDate(today, -1);
  const dateIsCustom = draft.date !== today && draft.date !== yesterday;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={isEdit ? "Kaydı düzenle" : "Yeni kayıt"}
      headerExtra={
        draft.fromRecurring && (
          <span className="eyebrow flex items-center gap-1">
            <Repeat size={12} /> Düzenli
          </span>
        )
      }
      footer={
        <div className="flex gap-2 pb-1">
          {isEdit && (
            <ConfirmButton onConfirm={remove} disabled={pending} confirmText="Sil">
              Sil
            </ConfirmButton>
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending || !minor}
            className="btn btn-primary flex-1"
          >
            {pending ? <Spinner /> : <Check size={18} strokeWidth={2.5} />}
            {isEdit ? "Güncelle" : "Deftere yaz"}
          </button>
        </div>
      }
    >
      {/* Tür */}
      <div role="radiogroup" aria-label="Tür" className="grid grid-cols-2 rounded-full bg-surface-2 p-1">
        {(["expense", "income"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={draft.kind === k}
            onClick={() => setKind(k)}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all",
              draft.kind === k ? "bg-surface text-ink shadow-sm" : "text-ink-3",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                k === "expense" ? "bg-expense" : "bg-income-fill",
                draft.kind !== k && "opacity-40",
              )}
            />
            {k === "expense" ? "Gider" : "Gelir"}
          </button>
        ))}
      </div>

      {/* Tutar */}
      <div className="py-6 text-center" aria-live="polite">
        <span className="sr-only">Tutar</span>
        <div
          className={cn(
            "num inline-flex items-baseline text-[clamp(2.75rem,13vw,4rem)] font-medium leading-none tracking-tight",
            !draft.amount && "text-ink-3",
          )}
        >
          <span className={cn("mr-1 text-[0.5em]", isExpense ? "text-expense" : "text-income")}>
            {isExpense ? "−" : "+"}
          </span>
          <span>{int}</span>
          {frac !== undefined && <span className="text-ink-2">,{frac}</span>}
          <span className="caret ml-0.5 inline-block h-[0.85em] w-[3px] translate-y-[0.08em] rounded-full bg-ink" />
          <span className="ml-2 text-[0.45em] text-ink-3">{currency === "TRY" ? "₺" : currency}</span>
        </div>
      </div>

      {/* Kategori */}
      <p className="eyebrow mb-2">Kategori</p>
      <div className="no-scrollbar -mx-5 overflow-x-auto px-5">
        <div className="grid w-max auto-cols-max grid-flow-col grid-rows-2 gap-1.5 pb-1">
          {kindCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={draft.categoryId === c.id}
              onClick={() => update({ categoryId: draft.categoryId === c.id ? null : c.id })}
              className="chip"
            >
              <span aria-hidden>{c.emoji}</span>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tarih + not */}
      <div className="mt-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          className="chip"
          aria-pressed={draft.date === today}
          onClick={() => update({ date: today })}
        >
          Bugün
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={draft.date === yesterday}
          onClick={() => update({ date: yesterday })}
        >
          Dün
        </button>
        <label className="chip relative cursor-pointer" aria-pressed={dateIsCustom}>
          <Calendar size={14} />
          {dateIsCustom ? dayMonthShort(draft.date) : "Tarih seç"}
          <input
            type="date"
            aria-label="Tarih"
            value={draft.date}
            required
            onChange={(e) => e.target.value && update({ date: e.target.value })}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
      <input
        name="note"
        className="input mt-3"
        placeholder="Açıklama (isteğe bağlı)"
        maxLength={200}
        value={draft.note}
        onChange={(e) => update({ note: e.target.value })}
        autoComplete="off"
        enterKeyHint="done"
      />

      {canRemind && (
        <div className="rise mt-4">
          <RemindPicker value={effectiveRemind} onChange={(d) => update({ remindDays: d })} />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-expense">
          {error}
        </p>
      )}

      {/* Tuş takımı */}
      <div className="mt-4 grid grid-cols-3 gap-1.5 pb-4" aria-label="Tuş takımı">
        {KEYS.map((k) =>
          k === "back" ? (
            <button
              key={k}
              type="button"
              aria-label="Sil (basılı tut: temizle)"
              onPointerDown={startHold}
              onPointerUp={() => endHold(true)}
              onPointerLeave={() => endHold(false)}
              onContextMenu={(e) => e.preventDefault()}
              className="grid h-14 select-none place-items-center rounded-2xl text-ink-2 transition-colors active:bg-surface-2"
            >
              <Delete size={22} />
            </button>
          ) : (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className="num h-14 select-none rounded-2xl bg-surface-2/60 text-2xl transition-[background-color,transform] duration-100 active:scale-95 active:bg-surface-2"
            >
              {k}
            </button>
          ),
        )}
      </div>
    </Sheet>
  );
}
