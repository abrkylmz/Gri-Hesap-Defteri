"use client";

import { Bell, BellRing, Calendar, Check, Delete, Repeat, Trash2 } from "lucide-react";
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
import { saveTransaction } from "@/lib/actions/entries";
import type { EntryKind, FxCode, TransactionRow } from "@/lib/types";
import { parseQuantity } from "@/lib/assets";
import { dayMonth, dayMonthShort, shiftDate } from "@/lib/dates";
import { displayAmount, KEYS, pressKey, type Key } from "@/lib/keypad";
import { formatMoney, FX_SYMBOL, minorToInput, toMinor } from "@/lib/money";
import { DEFAULT_REMIND_DAYS, FX_CODES, type TransactionInput } from "@/lib/validation";
import { enqueue, isNetworkError } from "@/lib/outbox";
import { useApp } from "@/components/app-context";
import { RemindPicker } from "@/components/remind-picker";
import { Sheet, useSheetState } from "@/components/sheet";
import { useDeleteWithUndo } from "@/components/use-delete-with-undo";
import { PUSH_HINT, usePush } from "@/components/use-push";
import { useToast } from "@/components/toast";
import { cn, Spinner } from "@/components/ui";
import { DatePicker } from "@/components/date-picker";
import { haptic } from "@/lib/haptics";

type Draft = {
  id?: string;
  kind: EntryKind;
  amount: string;
  categoryId: string | null;
  note: string;
  date: string;
  fromRecurring: boolean;
  /** Vadeden kaç gün önce hatırlatılacak; null = hatırlatma kapalı (🔔 düğmesiyle açılır) */
  remindDays: number | null;
  /** Düzenlenen kaydın asıl hali: silinince "Geri al" ile aynen geri yüklemek için */
  original?: TransactionRow;
  /** Dövizle giriş: seçili para birimi (null = TL; tutar bu parayla yazılır) ve kur metni */
  fxCode: FxCode | null;
  fxRate: string;
  /** Yeni kayıt için istemcide üretilen id (tekrar gönderimde çift kayıt olmasın) */
  newId?: string;
};

const rateToInput = (r: number) =>
  r.toLocaleString("tr-TR", { maximumFractionDigits: 4, useGrouping: false });

type TxSheetApi = {
  openNew: (opts?: { kind?: EntryKind; date?: string }) => void;
  /** `remind: true` → düzenleyici hatırlatma açık olarak açılır (ör. satırdaki "Hatırlat" eylemi). */
  openEdit: (tx: TransactionRow, opts?: { remind?: boolean }) => void;
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
          remindDays: null,
          fxCode: null,
          fxRate: "",
          newId: crypto.randomUUID(),
        });
      },
      openEdit: (tx, { remind = false } = {}) => {
        const turnOn = remind && tx.remind_days === null;
        show({
          id: tx.id,
          kind: tx.kind,
          amount:
            tx.fx_amount !== null
              ? minorToInput(Math.round(tx.fx_amount * 100))
              : tx.amount === null
                ? ""
                : minorToInput(tx.amount),
          categoryId: tx.category_id,
          note: tx.note ?? "",
          // Hatırlatma ileri bir ödeme tarihi ister; geçmiş tarihliyse yarına öner (kullanıcı değiştirebilir).
          date: turnOn && tx.occurred_on <= today ? shiftDate(today, 1) : tx.occurred_on,
          fromRecurring: Boolean(tx.recurring_id),
          remindDays: turnOn ? DEFAULT_REMIND_DAYS : tx.remind_days,
          original: tx,
          fxCode: tx.fx_code,
          fxRate: tx.fx_rate === null ? "" : rateToInput(tx.fx_rate),
        });
      },
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
  const { categories, currency, today, vapidPublicKey, fxRates, username, ledger } = useApp();
  const toast = useToast();
  const push = usePush(vapidPublicKey);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const deleteWithUndo = useDeleteWithUndo();
  const isEdit = Boolean(initial.id);
  /** Düzenlenen kaydın tutarı henüz bekleniyor mu (şablondan boş gelmiş)? */
  const originalPending = initial.original?.amount === null;
  // Dövizle girişte yazılan tutar o paradadır; TL karşılığı = tutar × kur (sunucu da aynı hesabı yapar).
  const typedMinor = toMinor(draft.amount);
  const fxRate = draft.fxCode ? parseQuantity(draft.fxRate) : null;
  const minor = draft.fxCode ? (typedMinor && fxRate ? Math.round(typedMinor * fxRate) : null) : typedMinor;
  // Kurlar TL cinsinden; başka ana para biriminde döviz seçici gösterilmez.
  const canFx = currency === "TRY" || draft.fxCode !== null;
  const isExpense = draft.kind === "expense";
  // Hatırlatma giderlere özgüdür; düzenli kayıttan üretilenler, düzenli kaydın kendisiyle hatırlatılır.
  const canRemind = isExpense && !draft.fromRecurring;
  const bellOn = canRemind && draft.remindDays !== null;
  const tomorrow = shiftDate(today, 1);

  const toggleBell = () =>
    bellOn
      ? update({ remindDays: null })
      : update({ remindDays: DEFAULT_REMIND_DAYS, date: draft.date > today ? draft.date : tomorrow });

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
    haptic("select");
    const remembered = lastCategory(kind);
    update({
      kind,
      categoryId:
        remembered && categories.some((c) => c.id === remembered && c.kind === kind)
          ? remembered
          : null,
    });
  };

  const setFx = (code: FxCode | null) => {
    if (code === draft.fxCode) return;
    haptic("select");
    const suggested = code ? fxRates[code] : undefined;
    update({ fxCode: code, fxRate: code ? (suggested ? rateToInput(suggested) : "") : "" });
  };

  const press = useCallback((key: Key) => {
    haptic("tap");
    setError(null);
    setDraft((d) => ({ ...d, amount: pressKey(d.amount, key) }));
  }, []);

  const save = useCallback(() => {
    if (pending) return;
    // Tutarı bekleyen (şablondan boş gelen) kayıtta tutar yine boş bırakılabilir; yeni kayıtta zorunlu.
    const keepPending = !minor && !draft.amount && originalPending;
    if (draft.fxCode && typedMinor && !fxRate) {
      haptic("warning");
      setError("Geçerli bir kur gir (ör. 41,52).");
      return;
    }
    if (!minor && !keepPending) {
      haptic("warning");
      setError("Önce bir tutar gir.");
      return;
    }
    if (bellOn && draft.date <= today) {
      haptic("warning");
      setError("Hatırlatma için ödeme tarihi bugünden sonra olmalı. Tarihi değiştir ya da 🔔'yu kapat.");
      return;
    }
    haptic("success");
    const input: TransactionInput = {
      id: draft.id,
      newId: draft.id ? undefined : draft.newId,
      kind: draft.kind,
        amount: minor ?? null,
        categoryId: draft.categoryId,
        note: draft.note,
        occurredOn: draft.date,
        remindDays: bellOn ? draft.remindDays : null,
      fx: draft.fxCode && typedMinor && fxRate ? { code: draft.fxCode, amount: typedMinor / 100, rate: fxRate } : null,
    };
    const rememberCategory = () => {
      try {
        if (draft.categoryId) localStorage.setItem(LAST_CATEGORY_KEY + draft.kind, draft.categoryId);
      } catch {
        /* yok say */
      }
    };
    // Bağlantı yoksa (ya da istek ağa ulaşamazsa) kayıt cihazda sıraya alınır, bağlantı gelince gönderilir.
    const queueOffline = () => {
      if (!enqueue(username, ledger.ownerId, input)) {
        setError("Bağlantı yok ve kayıt bu cihazda saklanamadı. Bağlantı gelince tekrar dene.");
        return;
      }
      rememberCategory();
      toast("Çevrimdışı · bağlantı gelince deftere yazılacak");
      onClose();
    };
    if (!navigator.onLine) {
      queueOffline();
      return;
    }
    startTransition(async () => {
      let res;
      try {
        res = await saveTransaction(input);
      } catch (e) {
        if (isNetworkError(e)) queueOffline();
        else setError("Beklenmeyen bir hata oluştu. Tekrar dene.");
        return;
      }
      if (!res.ok) {
        haptic("warning");
        setError(res.error);
        return;
      }
      rememberCategory();
      if (minor) {
        const signed = draft.kind === "expense" ? -minor : minor;
        toast(`${isEdit ? "Güncellendi" : "Deftere yazıldı"} · ${formatMoney(signed, currency, { sign: true })}`);
      } else {
        toast("Güncellendi · tutar hâlâ bekleniyor");
      }
      onClose();
    });
  }, [pending, minor, typedMinor, fxRate, draft, bellOn, today, isEdit, originalPending, currency, toast, onClose, username, ledger.ownerId]);

  const remove = () => {
    const original = initial.original;
    if (!original) return;
    haptic("warning");
    startTransition(async () => {
      if (await deleteWithUndo(original)) onClose();
    });
  };

  // Fiziksel klavye: rakamlar, virgül/nokta, geri silme, Enter.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      // Takvim açıkken tuşlar takvime aittir: tutarı değiştirmesin, Enter kaydetmesin.
      if (target.closest("[data-calendar]")) return;
      const typing = target.closest("input, textarea, select");
      if (e.key === "Enter" && (!typing || ["note", "fx-rate"].includes(target.getAttribute("name") ?? ""))) {
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
      haptic("warning");
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
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              aria-label="Kaydı sil"
              title="Kaydı sil (geri alınabilir)"
              className="btn btn-ghost w-12 shrink-0 px-0 text-ink-3 hover:border-expense/40 hover:text-expense"
            >
              <Trash2 size={18} />
            </button>
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
      <div className={cn("text-center", canFx ? "pb-4 pt-5" : "py-6")} aria-live="polite">
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
          {/* key: her tuşta animasyon baştan başlar → yazarken imleç sabit görünür */}
          <span
            key={draft.amount}
            aria-hidden
            className="caret ml-0.5 inline-block h-[0.85em] w-[3px] translate-y-[0.08em] rounded-full bg-ink"
          />
          <span className="ml-2 text-[0.45em] text-ink-3">
            {draft.fxCode ? FX_SYMBOL[draft.fxCode] : currency === "TRY" ? "₺" : currency}
          </span>
        </div>

        {canFx && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div role="radiogroup" aria-label="Para birimi" className="inline-flex rounded-full bg-surface-2 p-0.5">
              {([null, ...FX_CODES] as (FxCode | null)[]).map((code) => (
                <button
                  key={code ?? "TRY"}
                  type="button"
                  role="radio"
                  aria-checked={draft.fxCode === code}
                  aria-label={code ?? "Türk lirası"}
                  onClick={() => setFx(code)}
                  className={cn(
                    "num h-8 min-w-11 rounded-full px-3 text-sm transition-colors",
                    draft.fxCode === code ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-3",
                  )}
                >
                  {code ? FX_SYMBOL[code] : "₺"}
                </button>
              ))}
            </div>
            {draft.fxCode && (
              <div className="rise flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-ink-2">
                <span>
                  ≈{" "}
                  <strong className="num font-medium text-ink">
                    {minor ? formatMoney(minor, currency) : "—"}
                  </strong>
                </span>
                <span className="text-ink-3">·</span>
                <label className="flex items-center gap-1.5">
                  <span className="text-ink-3">1 {FX_SYMBOL[draft.fxCode]} =</span>
                  <input
                    name="fx-rate"
                    inputMode="decimal"
                    autoComplete="off"
                    value={draft.fxRate}
                    onChange={(e) => update({ fxRate: e.target.value })}
                    placeholder="kur"
                    aria-label="Kur (TL)"
                    className="num h-8 w-24 rounded-lg border border-line bg-surface px-2 text-center text-sm text-ink outline-none focus:border-ink-3"
                  />
                  <span className="text-ink-3">₺</span>
                </label>
              </div>
            )}
          </div>
        )}
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
              onClick={() => {
                haptic("select");
                update({ categoryId: draft.categoryId === c.id ? null : c.id });
              }}
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
        <DatePicker value={draft.date} onChange={(date) => update({ date })}>
          {(open) => (
            <button type="button" onClick={open} className="chip" aria-pressed={dateIsCustom} aria-label="Tarih seç">
              <Calendar size={14} />
              {dateIsCustom ? dayMonthShort(draft.date) : "Tarih seç"}
            </button>
          )}
        </DatePicker>
        {canRemind && (
          <button
            type="button"
            onClick={toggleBell}
            aria-pressed={bellOn}
            aria-label={bellOn ? "Hatırlatmayı kapat" : "Bu ödemeyi hatırlat"}
            className={cn(
              "chip ml-auto shrink-0",
              bellOn && "!border-expense !bg-expense !text-white",
            )}
          >
            {bellOn ? <BellRing size={14} /> : <Bell size={14} />}
            Hatırlat
          </button>
        )}
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

      {bellOn && (
        <div className="rise mt-3 space-y-3 rounded-2xl border border-expense/30 bg-expense/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm">
            <BellRing size={15} className="shrink-0 text-expense" />
            {draft.date > today ? (
              <span>
                Ödeme tarihi <strong>{dayMonth(draft.date)}</strong>. Yukarıdaki tarihten değiştirebilirsin.
              </span>
            ) : (
              <span className="text-expense">Ödeme tarihi bugünden sonra olmalı; yukarıdan ileri bir tarih seç.</span>
            )}
          </p>
          <RemindPicker value={draft.remindDays} onChange={(d) => update({ remindDays: d })} />
          {push.status !== "on" && push.status !== "checking" && (
            <div className="flex flex-wrap items-center gap-2 border-t border-expense/20 pt-3 text-xs text-ink-2">
              <span className="min-w-0 flex-1">
                {PUSH_HINT[push.status]} Hatırlatma yine de defterin üstünde görünür.
              </span>
              {push.status === "off" && (
                <button
                  type="button"
                  onClick={push.enable}
                  disabled={push.pending}
                  className="btn btn-primary h-9 shrink-0 px-3 text-xs"
                >
                  {push.pending ? <Spinner /> : <Bell size={14} />} Bildirimleri aç
                </button>
              )}
            </div>
          )}
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
