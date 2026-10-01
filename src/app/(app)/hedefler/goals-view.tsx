"use client";

import { Minus, Plus, Target } from "lucide-react";
import { useState, useTransition } from "react";
import { addToGoal, deleteGoal, saveGoal } from "@/lib/actions/goals";
import { haptic } from "@/lib/haptics";
import { GOAL_ICONS, type Goal } from "@/lib/goals";
import { minorToInput, toMinor } from "@/lib/money";
import { useApp } from "@/components/app-context";
import { useAddRequest } from "@/components/assets/add-request";
import { AppIcon, ICONS, iconKey } from "@/components/category-icon";
import { DateField } from "@/components/date-picker";
import { GoalSummary } from "@/components/goals/goal-card";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, CountUpMoney, Field, Money, Spinner } from "@/components/ui";

type Draft = { id?: string; name: string; icon: string; target: string; saved: string; due: string };

/** Finansal hedefler: araba fonu, tatil, ev peşinatı… İlerleme, aylık gereken ve hızlı para ekleme. */
export function GoalsView({ goals }: { goals: Goal[] }) {
  const { currency } = useApp();
  const editor = useSheetState<Draft>();
  const deposit = useSheetState<Goal>();
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const totalSaved = goals.reduce((s, g) => s + Math.min(g.saved, g.target), 0);

  const add = () => editor.show({ name: "", icon: "piggy", target: "", saved: "", due: "" });
  useAddRequest("goal", add);

  return (
    <div className="mx-auto max-w-3xl px-5 lg:px-10">
      <PageHeader
        eyebrow="Birikim"
        title="Hedefler"
        action={
          <button
            type="button"
            onClick={add}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface/60 px-3 text-xs font-semibold text-ink-2 backdrop-blur transition-colors hover:bg-surface hover:text-ink"
          >
            <Plus size={15} /> Hedef ekle
          </button>
        }
      />

      {goals.length > 0 ? (
        <>
          <section className="rise mt-6 rounded-3xl border border-line bg-surface p-4 sm:p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
              <span className="grid size-7 place-items-center rounded-lg bg-sky-500/12 text-sky-700 dark:text-sky-300">
                <Target size={15} />
              </span>
              Toplam birikim
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <CountUpMoney
                id="goals-saved"
                minor={totalSaved}
                currency={currency}
                fracClassName="opacity-40"
                className="text-[1.75rem] font-semibold leading-none tracking-tight"
              />
              <span className="text-sm text-ink-3">
                / <Money minor={totalTarget} currency={currency} fracClassName="opacity-40" />
              </span>
            </p>
            <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-sky-500 transition-[width] duration-700"
                style={{ width: `${totalTarget ? (totalSaved / totalTarget) * 100 : 0}%` }}
              />
            </span>
          </section>

          <ul className="mt-4 space-y-3 pb-6">
            {goals.map((g) => (
              <li key={g.id} className="rise rounded-3xl border border-line bg-surface p-4">
                <button
                  type="button"
                  className="w-full text-left"
                  aria-label={`${g.name}: düzenle`}
                  onClick={() =>
                    editor.show({
                      id: g.id,
                      name: g.name,
                      icon: g.icon,
                      target: minorToInput(g.target),
                      saved: g.saved ? minorToInput(g.saved) : "",
                      due: g.due ?? "",
                    })
                  }
                >
                  <GoalSummary goal={g} />
                </button>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => deposit.show(g)}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-sky-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    <Plus size={15} /> Para ekle
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="rise mt-8 rounded-3xl border border-dashed border-line p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-sky-500/12 text-sky-700 dark:text-sky-300">
            <Target size={26} />
          </span>
          <p className="mt-3 font-semibold">İlk hedefini koy</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
            Araba fonu, tatil, ev peşinatı… Hedef tutarı ve tarihi gir; ayda ne kadar biriktirmen gerektiğini
            gösterelim.
          </p>
          <button type="button" onClick={add} className="btn btn-primary mt-4 h-10 px-5 text-sm">
            <Plus size={16} /> Hedef ekle
          </button>
        </div>
      )}

      {editor.item && (
        <GoalEditor initial={editor.item} open={editor.open} onClose={editor.close} onExited={editor.exited} />
      )}
      {deposit.item && (
        <DepositSheet goal={deposit.item} open={deposit.open} onClose={deposit.close} onExited={deposit.exited} />
      )}
    </div>
  );
}

function MoneyField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { currency } = useApp();
  return (
    <span className="relative block">
      <input
        className={cn("input num pr-12", value && !toMinor(value) && value.trim() !== "0" && "border-expense")}
        inputMode="decimal"
        placeholder={placeholder ?? "0,00"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">{currency}</span>
    </span>
  );
}

function GoalEditor({
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
  const toast = useToast();
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const update = (patch: Partial<Draft>) => {
    setError(null);
    setD((x) => ({ ...x, ...patch }));
  };

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, msg: string) =>
    startTransition(async () => {
      const res = await fn().catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı. Tekrar dene." }));
      if (!res.ok) {
        haptic("warning");
        return setError(res.error);
      }
      toast(msg);
      onClose();
    });

  const save = () => {
    const target = toMinor(d.target);
    const saved = d.saved.trim() ? toMinor(d.saved) : 0;
    if (!d.name.trim()) return setError("Hedefe bir ad ver (ör. Araba fonu).");
    if (!target) return setError("Hedef tutarı gir.");
    if (saved === null) return setError("Biriken tutar geçersiz.");
    haptic("success");
    run(
      () => saveGoal({ id: d.id, name: d.name, icon: d.icon, target, saved, due: d.due || null }),
      d.id ? "Hedef güncellendi" : "Hedef eklendi",
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={d.id ? "Hedefi düzenle" : "Yeni hedef"}
      footer={
        <div className="flex gap-2 pb-1">
          {d.id && (
            <ConfirmButton
              disabled={pending}
              confirmText="Sil"
              onConfirm={() => run(() => deleteGoal(d.id!), "Hedef silindi")}
            >
              Sil
            </ConfirmButton>
          )}
          <button type="button" onClick={save} disabled={pending} className="btn btn-primary flex-1">
            {pending && <Spinner />} Kaydet
          </button>
        </div>
      }
    >
      <div className="space-y-5 pb-5">
        <div className="flex items-center gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sky-500/12 text-sky-700 dark:text-sky-300">
            <AppIcon name={d.icon} size={26} />
          </span>
          <input
            className="input"
            placeholder="ör. Araba fonu"
            maxLength={40}
            value={d.name}
            autoFocus={!d.id}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-6 gap-1">
          {GOAL_ICONS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => update({ icon: k })}
              aria-pressed={iconKey(d.icon) === k}
              aria-label={`Simge: ${ICONS[k].label}`}
              className={cn(
                "grid aspect-square place-items-center rounded-xl transition-colors",
                iconKey(d.icon) === k ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2",
              )}
            >
              <AppIcon name={k} size={19} />
            </button>
          ))}
        </div>
        <Field label="Hedef tutar">
          <MoneyField value={d.target} onChange={(target) => update({ target })} placeholder="50.000" />
        </Field>
        <Field label="Şu ana kadar biriken (isteğe bağlı)">
          <MoneyField value={d.saved} onChange={(saved) => update({ saved })} />
        </Field>
        <Field label="Hedef tarih (isteğe bağlı)" hint="Girersen ayda ne kadar biriktirmen gerektiğini hesaplarız.">
          <div className="flex gap-2">
            <DateField
              value={d.due}
              onChange={(due) => update({ due })}
              ariaLabel="Hedef tarih"
              placeholder="Tarih seç"
            />
            {d.due && (
              <button type="button" onClick={() => update({ due: "" })} className="btn btn-ghost shrink-0 px-3 text-xs">
                Kaldır
              </button>
            )}
          </div>
        </Field>
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** Hedefe hızlıca para ekle ya da çek. */
function DepositSheet({
  goal,
  open,
  onClose,
  onExited,
}: {
  goal: Goal;
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}) {
  const toast = useToast();
  const { currency } = useApp();
  const [mode, setMode] = useState<"in" | "out">("in");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const amount = toMinor(value);

  const save = () => {
    if (!amount) return setError("Geçerli bir tutar gir.");
    haptic("success");
    startTransition(async () => {
      const res = await addToGoal(goal.id, mode === "in" ? amount : -amount).catch(() => ({
        ok: false as const,
        error: "Bağlantı kurulamadı. Tekrar dene.",
      }));
      if (!res.ok) return setError(res.error);
      toast(mode === "in" ? `${goal.name}: birikim eklendi` : `${goal.name}: birikimden çekildi`);
      onClose();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={goal.name}
      footer={
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary mb-1 w-full">
          {pending && <Spinner />} {mode === "in" ? "Birikime ekle" : "Birikimden çek"}
        </button>
      }
    >
      <div className="space-y-4 pb-5">
        <p className="text-sm text-ink-2">
          Şu an <Money minor={goal.saved} currency={currency} className="font-semibold text-ink" /> /{" "}
          <Money minor={goal.target} currency={currency} />
        </p>
        <div role="radiogroup" aria-label="İşlem" className="grid grid-cols-2 rounded-full bg-surface-2 p-1">
          {(
            [
              ["in", "Ekle", Plus],
              ["out", "Çek", Minus],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={mode === k}
              onClick={() => setMode(k)}
              className={cn(
                "flex h-10 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-all",
                mode === k ? "bg-surface text-ink shadow-sm" : "text-ink-3",
              )}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <MoneyField
          value={value}
          onChange={(v) => {
            setError(null);
            setValue(v);
          }}
          placeholder="1.000"
        />
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
