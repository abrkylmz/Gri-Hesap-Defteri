"use client";

import { ChevronDown, ChevronRight, CreditCard, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteLimit, saveLimit } from "@/lib/actions/limits";
import { haptic } from "@/lib/haptics";
import {
  bankKey,
  LIMIT_KINDS,
  limitKind,
  summarizeLimits,
  type CreditLimit,
  type LimitKind,
} from "@/lib/limits";
import { minorToInput, toMinor } from "@/lib/money";
import { useApp } from "@/components/app-context";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { AppIcon } from "@/components/category-icon";
import { BankPicker } from "@/components/assets/bank-picker";
import { cn, CountUpMoney, Field, Money, Spinner } from "@/components/ui";

/** Kapalıyken gösterilen banka sayısı */
const VISIBLE_BANKS = 2;

/**
 * "Limitlerim": bankalardaki kredi kartı ve ek hesap limitleri — banka banka ve toplamda.
 * Güncel borç girilen kalemlerde kullanılabilir limit ve doluluk da gösterilir.
 */
export function LimitsCard({ limits, className }: { limits: CreditLimit[]; className?: string }) {
  const { currency } = useApp();
  const sheet = useSheetState<LimitDraft>();
  const [expanded, setExpanded] = useState(false);
  const s = summarizeLimits(limits);
  const banks = s.banks.map((b) => b.bank);

  const add = (bank = "") => sheet.show({ bank, kind: "card", name: "", limit: "", used: "" });
  const edit = (l: CreditLimit) =>
    sheet.show({
      id: l.id,
      bank: l.bank,
      kind: l.kind,
      name: l.name ?? "",
      limit: minorToInput(l.limit),
      used: l.used === null ? "" : l.used === 0 ? "0" : minorToInput(l.used),
    });

  return (
    <section
      aria-label="Limitlerim"
      className={cn(
        "rise rounded-3xl border border-line bg-surface p-4 shadow-[0_12px_32px_-20px_rgb(0_0_0/0.35)] sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
            <span className="grid size-7 place-items-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <CreditCard size={15} />
            </span>
            Limitlerim
          </p>
          {limits.length > 0 ? (
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-sm text-ink-3">Toplam</span>
              <CountUpMoney
                id="limits-total"
                minor={s.total}
                currency={currency}
                fracClassName="opacity-40"
                className="text-[1.75rem] font-semibold leading-none tracking-tight sm:text-3xl"
              />
            </p>
          ) : (
            <p className="mt-2 max-w-xs text-sm text-ink-2">
              Kredi kartı ve ek hesap limitlerini ekle; hangi bankada ne kadar limitin olduğunu gör.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => add()}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-bg/60 px-3.5 text-xs font-semibold shadow-sm transition-colors hover:bg-surface-2"
        >
          <Plus size={15} /> Limit ekle
        </button>
      </div>

      {limits.length > 0 && (
        <>
          {/* Türe göre toplamlar */}
          <div className="mt-3 flex flex-wrap gap-2">
            {LIMIT_KINDS.map((k) => (
              <span key={k.kind} className="flex items-center gap-1.5 rounded-full bg-surface-2/70 px-3 py-1.5 text-xs">
                <AppIcon name={k.icon} size={14} className="text-violet-600 dark:text-violet-300" />
                <span className="text-ink-2">{k.label}</span>
                <Money minor={k.kind === "card" ? s.card : s.overdraft} currency={currency} className="font-semibold" />
              </span>
            ))}
          </div>

          {/* Borcu girilmiş kalemlerde doluluk */}
          {s.trackedLimit > 0 && (
            <div className="mt-4">
              <UsageBar used={s.used} limit={s.trackedLimit} />
              <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-ink-2">
                <span>
                  Kullanılabilir <Money minor={s.available} currency={currency} className="font-semibold text-ink" />
                </span>
                <span>
                  Borç <Money minor={s.used} currency={currency} className="font-semibold text-expense" />
                </span>
              </p>
            </div>
          )}

          {/* Bankalar */}
          <ul className="mt-4 space-y-2">
            {s.banks.map((b, index) => (
              <li
                key={bankKey(b.bank)}
                className={cn(
                  "rounded-2xl border border-line bg-surface-2/40 p-3",
                  // İlk birkaç banka görünür; gerisi alttaki okla açılır (kart ekranı kaplamasın).
                  !expanded && index >= VISIBLE_BANKS && "hidden",
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-500/15 text-sm font-bold text-violet-700 dark:text-violet-300">
                    {b.bank.trim().charAt(0).toLocaleUpperCase("tr")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{b.bank}</span>
                  <span className="shrink-0 text-right">
                    <Money
                      minor={b.total}
                      currency={currency}
                      fracClassName="opacity-40"
                      className="text-sm font-semibold"
                    />
                    <span className="num block text-[10px] text-ink-3">%{Math.round((b.total / s.total) * 100)}</span>
                  </span>
                </div>
                <ul className="mt-2 divide-y divide-line border-t border-line">
                  {b.items.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => edit(l)}
                        aria-label={`${b.bank} ${l.name ?? limitKind(l.kind).label}: düzenle`}
                        className="flex w-full items-center gap-2.5 rounded-lg px-1 py-2 text-left transition-colors hover:bg-surface-2"
                      >
                        <span aria-hidden className="text-base">
                          <AppIcon name={limitKind(l.kind).icon} size={17} className="text-ink-2" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{l.name ?? limitKind(l.kind).label}</span>
                          {l.used !== null ? (
                            <span className="mt-1 block">
                              <UsageBar used={l.used} limit={l.limit} thin />
                              <span className="mt-0.5 block text-[11px] text-ink-3">
                                Kalan{" "}
                                <Money
                                  minor={Math.max(0, l.limit - l.used)}
                                  currency={currency}
                                  className="text-ink-2"
                                />
                                {l.used > l.limit && <span className="text-expense"> · limit aşıldı</span>}
                              </span>
                            </span>
                          ) : (
                            <span className="block text-[11px] text-ink-3">
                              {l.name ? limitKind(l.kind).label : "Borç girilmedi"}
                            </span>
                          )}
                        </span>
                        <Money
                          minor={l.limit}
                          currency={currency}
                          fracClassName="opacity-40"
                          className="shrink-0 text-sm"
                        />
                        <ChevronRight size={15} className="shrink-0 text-ink-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => add(b.bank)}
                  className="mt-1 flex items-center gap-1 rounded-lg px-1 py-1 text-xs font-medium text-ink-3 hover:text-ink"
                >
                  <Plus size={13} /> {b.bank} için limit ekle
                </button>
              </li>
            ))}
          </ul>
          {s.banks.length > VISIBLE_BANKS && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2"
            >
              {expanded ? "Daha az göster" : `Tümünü göster (${s.banks.length - VISIBLE_BANKS} banka daha)`}
              <ChevronDown size={16} className={cn("transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </>
      )}

      {sheet.item && (
        <LimitEditor
          initial={sheet.item}
          banks={banks}
          open={sheet.open}
          onClose={sheet.close}
          onExited={sheet.exited}
        />
      )}
    </section>
  );
}

/** Doluluk çubuğu: %80'i geçince turuncu, aşımda kırmızı. */
function UsageBar({ used, limit, thin = false }: { used: number; limit: number; thin?: boolean }) {
  const ratio = limit > 0 ? used / limit : 0;
  return (
    <span
      className={cn("relative block overflow-hidden rounded-full bg-surface-2", thin ? "h-1" : "h-2")}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(1, ratio) * 100)}
      aria-label="Limit kullanımı"
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700",
          ratio > 1 ? "bg-expense" : ratio >= 0.8 ? "bg-amber-500" : "bg-violet-500",
        )}
        style={{ width: `${Math.min(1, ratio) * 100}%` }}
      />
    </span>
  );
}

type LimitDraft = { id?: string; bank: string; kind: LimitKind; name: string; limit: string; used: string };

function LimitEditor({
  initial,
  banks,
  open,
  onClose,
  onExited,
}: {
  initial: LimitDraft;
  banks: string[];
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}) {
  const { currency } = useApp();
  const toast = useToast();
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const update = (patch: Partial<LimitDraft>) => {
    setError(null);
    setD((x) => ({ ...x, ...patch }));
  };

  const limit = toMinor(d.limit);
  const usedRaw = d.used.trim();
  const used = !usedRaw ? null : /^0+([.,]0*)?$/.test(usedRaw) ? 0 : toMinor(usedRaw);

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
    if (!d.bank.trim()) return setError("Banka adını yaz.");
    if (!limit) return setError("Geçerli bir limit gir (ör. 50.000).");
    if (usedRaw && used === null) return setError("Borç tutarı geçersiz.");
    haptic("success");
    run(
      () => saveLimit({ id: d.id, bank: d.bank, kind: d.kind, name: d.name, limit, used }),
      d.id ? "Limit güncellendi" : "Limit eklendi",
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={d.id ? "Limiti düzenle" : "Limit ekle"}
      footer={
        <div className="flex gap-2 pb-1">
          {d.id && (
            <ConfirmButton
              disabled={pending}
              confirmText="Sil"
              onConfirm={() => run(() => deleteLimit(d.id!), "Limit silindi")}
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
        <div role="radiogroup" aria-label="Tür" className="grid grid-cols-2 gap-2">
          {LIMIT_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={d.kind === k.kind}
              onClick={() => {
                haptic("select");
                update({ kind: k.kind });
              }}
              className={cn(
                "flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm transition-all",
                d.kind === k.kind
                  ? "border-ink bg-surface-2 font-semibold"
                  : "border-line text-ink-2 hover:bg-surface-2",
              )}
            >
              <AppIcon name={k.icon} size={14} className="text-violet-600 dark:text-violet-300" /> {k.label}
            </button>
          ))}
        </div>

        {/* label yerine div: içindeki liste düğmeleri etikete tıklama olarak sayılmasın */}
        <div>
          <p className="eyebrow mb-2">Banka</p>
          <BankPicker value={d.bank} onChange={(bank) => update({ bank })} mine={banks} autoFocus={!d.id && !d.bank} />
        </div>

        <Field label="Ad (isteğe bağlı)" hint={d.kind === "card" ? "ör. Bonus Platinum" : "ör. Vadesiz ek hesap"}>
          <input
            className="input"
            maxLength={40}
            value={d.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder={d.kind === "card" ? "Kartın adı" : "Hesabın adı"}
          />
        </Field>

        <Field label="Limit">
          <span className="relative block">
            <input
              className={cn("input num pr-12 text-lg", d.limit && !limit && "border-expense")}
              inputMode="decimal"
              placeholder="50.000"
              value={d.limit}
              onChange={(e) => update({ limit: e.target.value })}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">{currency}</span>
          </span>
        </Field>

        <Field
          label="Güncel borç (isteğe bağlı)"
          hint="Girersen kullanılabilir limitini ve doluluğu gösteririz. Değiştikçe buradan güncelle."
        >
          <span className="relative block">
            <input
              className={cn("input num pr-12", usedRaw && used === null && "border-expense")}
              inputMode="decimal"
              placeholder="0,00"
              value={d.used}
              onChange={(e) => update({ used: e.target.value })}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">{currency}</span>
          </span>
        </Field>
        {limit && used !== null && (
          <p className="-mt-3 text-sm text-ink-2">
            Kullanılabilir:{" "}
            <Money minor={Math.max(0, limit - used)} currency={currency} className="font-semibold text-ink" />
            {used > limit && <span className="text-expense"> · limit aşılmış</span>}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
