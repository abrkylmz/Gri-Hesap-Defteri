"use client";

import { Bell, Plus } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { deleteRecurring, saveRecurring, setRecurringActive } from "@/lib/actions/entries";
import type { EntryKind, RecurringRow } from "@/lib/types";
import { monthOf, monthStart } from "@/lib/dates";
import { minorToInput, toMinor } from "@/lib/money";
import { DEFAULT_REMIND_DAYS } from "@/lib/validation";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { KindToggle, PageHeader } from "@/components/page-header";
import { RemindPicker } from "@/components/remind-picker";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Field, Money, Spinner } from "@/components/ui";

type Draft = {
  id?: string;
  kind: EntryKind;
  amount: string;
  categoryId: string | null;
  note: string;
  day: number;
  startsOn: string;
  active: boolean;
  remindDays: number | null;
};

const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });

export function RecurringManager({ recurring }: { recurring: RecurringRow[] }) {
  const { currency, categoryById, today } = useApp();
  const toast = useToast();
  const sheet = useSheetState<Draft>();
  const [, startTransition] = useTransition();
  const [items, setOptimisticActive] = useOptimistic(
    recurring,
    (state, { id, active }: { id: string; active: boolean }) =>
      state.map((r) => (r.id === id ? { ...r, active } : r)),
  );

  const active = items.filter((r) => r.active);
  const fixedIncome = active.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);
  const fixedExpense = active.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);

  const toggle = (r: RecurringRow) =>
    startTransition(async () => {
      setOptimisticActive({ id: r.id, active: !r.active });
      const res = await setRecurringActive(r.id, !r.active);
      if (!res.ok) toast(res.error, "error");
    });

  const openNew = () =>
    sheet.show({
      kind: "expense",
      amount: "",
      categoryId: null,
      note: "",
      day: Number(today.slice(8, 10)),
      startsOn: monthStart(monthOf(today)),
      active: true,
      remindDays: DEFAULT_REMIND_DAYS,
    });

  return (
    <div className="mx-auto max-w-3xl px-5 lg:px-10">
      <PageHeader
        eyebrow="Otomatik"
        title="Düzenli kayıtlar"
        action={
          <button type="button" onClick={openNew} className="btn btn-primary">
            <Plus size={18} /> Yeni
          </button>
        }
      >
        Kira, maaş, abonelikler… Her ay ilgili gün geldiğinde deftere kendiliğinden yazılır.
      </PageHeader>

      {items.length > 0 && (
        <div className="card rise mt-8 grid grid-cols-3 divide-x divide-line p-0">
          <Summary label="Sabit gelir">
            <Money minor={fixedIncome} currency={currency} className="text-income" />
          </Summary>
          <Summary label="Sabit gider">
            <Money minor={fixedExpense} currency={currency} />
          </Summary>
          <Summary label="Gelire oranı">
            <span className="num">{fixedIncome > 0 ? pct.format(fixedExpense / fixedIncome) : "—"}</span>
          </Summary>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
          <p className="font-serif text-2xl">Henüz düzenli kayıt yok.</p>
          <p className="mt-1 text-sm text-ink-2">Maaşını ya da kiranı bir kez ekle, gerisini defter halletsin.</p>
          <button type="button" onClick={openNew} className="btn btn-primary mt-6">
            <Plus size={18} /> İlk düzenli kaydı ekle
          </button>
        </div>
      ) : (
        <ul className="mt-8">
          {items.map((r) => {
            const cat = r.category_id ? categoryById.get(r.category_id) : undefined;
            return (
              <li key={r.id} className="flex items-center gap-3 border-b border-line py-3">
                <button
                  type="button"
                  onClick={() =>
                    sheet.show({
                      id: r.id,
                      kind: r.kind,
                      amount: minorToInput(r.amount),
                      categoryId: r.category_id,
                      note: r.note ?? "",
                      day: r.day_of_month,
                      startsOn: r.starts_on,
                      active: r.active,
                      remindDays: r.remind_days,
                    })
                  }
                  className={cn("flex min-w-0 flex-1 items-center gap-3 text-left", !r.active && "opacity-40")}
                >
                  <span className="flex w-11 shrink-0 flex-col items-center rounded-xl border border-line py-1">
                    <span className="num text-lg font-medium leading-none">{r.day_of_month}</span>
                    <span className="text-[9px] uppercase tracking-wider text-ink-3">her ay</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate font-medium">
                        {cat?.emoji ?? UNCATEGORIZED.emoji} {r.note || cat?.name || UNCATEGORIZED.name}
                      </span>
                      <span className="leader" />
                      <Money
                        minor={r.kind === "income" ? r.amount : -r.amount}
                        currency={currency}
                        sign
                        className={cn(r.kind === "income" && "text-income")}
                      />
                    </span>
                    <span className="flex items-center gap-2 text-xs text-ink-3">
                      {r.note && cat && <span>{cat.name}</span>}
                      {r.kind === "expense" && r.remind_days !== null && (
                        <span className="flex items-center gap-1">
                          <Bell size={11} /> {r.remind_days === 0 ? "aynı gün" : `${r.remind_days} gün önce`}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                <Switch checked={r.active} onChange={() => toggle(r)} label={r.active ? "Duraklat" : "Etkinleştir"} />
              </li>
            );
          })}
        </ul>
      )}

      {sheet.item && (
        <RecurringEditor initial={sheet.item} open={sheet.open} onClose={sheet.close} onExited={sheet.exited} />
      )}
    </div>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-4">
      <p className="eyebrow truncate">{label}</p>
      <p className="mt-1.5 truncate text-sm sm:text-base">{children}</p>
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-ink" : "bg-surface-2 ring-1 ring-line",
      )}
    >
      <span
        className={cn(
          "absolute top-1 size-5 rounded-full transition-all duration-200",
          checked ? "left-6 bg-income-fill" : "left-1 bg-ink-3",
        )}
      />
    </button>
  );
}

function RecurringEditor({
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
  const { categories, currency } = useApp();
  const toast = useToast();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(initial.id);
  const set = (patch: Partial<Draft>) => {
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const kindCategories = categories.filter((c) => c.kind === draft.kind);

  const save = () => {
    const amount = toMinor(draft.amount);
    if (!amount) return setError("Geçerli bir tutar gir.");
    startTransition(async () => {
      const res = await saveRecurring({
        id: draft.id,
        kind: draft.kind,
        amount,
        categoryId: draft.categoryId,
        note: draft.note,
        dayOfMonth: draft.day,
        startsOn: draft.startsOn,
        active: draft.active,
        remindDays: draft.kind === "expense" ? draft.remindDays : null,
      });
      if (!res.ok) return setError(res.error);
      toast(isEdit ? "Düzenli kayıt güncellendi" : "Düzenli kayıt eklendi");
      onClose();
    });
  };

  const remove = () => {
    if (!draft.id) return;
    const id = draft.id;
    startTransition(async () => {
      const res = await deleteRecurring(id);
      if (!res.ok) return setError(res.error);
      toast("Düzenli kayıt silindi");
      onClose();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={isEdit ? "Düzenli kaydı düzenle" : "Yeni düzenli kayıt"}
      footer={
        <div className="flex gap-2 pb-1">
          {isEdit && (
            <ConfirmButton onConfirm={remove} disabled={pending} confirmText="Sil">
              Sil
            </ConfirmButton>
          )}
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary flex-1">
            {pending && <Spinner />} Kaydet
          </button>
        </div>
      }
    >
      <form
        className="space-y-5 pb-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <KindToggle value={draft.kind} onChange={(kind) => set({ kind, categoryId: null })} />

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Tutar">
            <div className="relative">
              <input
                className="input num pr-12 text-lg"
                inputMode="decimal"
                placeholder="0"
                value={draft.amount}
                onChange={(e) => set({ amount: e.target.value })}
                autoFocus={!isEdit}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">{currency}</span>
            </div>
          </Field>
          <Field label="Ayın günü">
            <select
              className="input num w-24"
              value={draft.day}
              onChange={(e) => set({ day: Number(e.target.value) })}
            >
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {draft.day > 28 && (
          <p className="-mt-3 text-xs text-ink-3">Bu günü olmayan aylarda ayın son gününe yazılır.</p>
        )}

        <div>
          <p className="eyebrow mb-2">Kategori</p>
          <div className="flex flex-wrap gap-1.5">
            {kindCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={draft.categoryId === c.id}
                onClick={() => set({ categoryId: draft.categoryId === c.id ? null : c.id })}
              >
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>

        <Field label="Açıklama">
          <input
            className="input"
            placeholder={draft.kind === "expense" ? "ör. Ev kirası" : "ör. Maaş"}
            maxLength={200}
            value={draft.note}
            onChange={(e) => set({ note: e.target.value })}
          />
        </Field>

        {draft.kind === "expense" && (
          <RemindPicker value={draft.remindDays} onChange={(remindDays) => set({ remindDays })} />
        )}

        <Field label="Başlangıç" hint="Bu tarihten itibaren her ay deftere yazılır; geçmiş aylar da tamamlanır.">
          <input
            type="date"
            className="input"
            value={draft.startsOn}
            required
            onChange={(e) => e.target.value && set({ startsOn: e.target.value })}
          />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
