"use client";

import { ChevronRight, Plus, Wallet as WalletIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteWallet, saveWallet } from "@/lib/actions/wallets";
import { haptic } from "@/lib/haptics";
import { minorToInput, toMinor } from "@/lib/money";
import { WALLET_KINDS, walletKind, type Wallet, type WalletKind } from "@/lib/wallets";
import { useApp } from "@/components/app-context";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, CountUpMoney, Field, Money, Spinner } from "@/components/ui";

/** Çubuk ve nokta renkleri: en büyük hesap yeşil, sonrakiler grinin tonları. */
const TONES = ["bg-income-fill", "bg-ink", "bg-ink/45", "bg-ink/20"];
/** İlk bu kadar hesap görünür; gerisi "Tümünü göster" ile açılır. */
const MOBILE_ROWS = 4;

const dayMs = 86_400_000;
function updatedText(ms: number) {
  const days = Math.floor((Date.now() - ms) / dayMs);
  if (days <= 0) return "bugün güncellendi";
  if (days === 1) return "dün güncellendi";
  if (days < 30) return `${days} gün önce güncellendi`;
  return `${Math.floor(days / 30)} ay önce güncellendi`;
}

/**
 * Ana ekrandaki "Nakit varlıklarım": hangi hesapta ne kadar para olduğu ve toplamı.
 * Bakiyeler elle girilir (banka hesabı, nakit, birikim…).
 */
export function CashCard({ wallets, className }: { wallets: Wallet[]; className?: string }) {
  const { currency } = useApp();
  const sheet = useSheetState<WalletDraft>();
  const [expanded, setExpanded] = useState(false);
  const total = wallets.reduce((s, w) => s + w.balance, 0);
  // Bakiyesi büyükten küçüğe; renk sırası da buna göre.
  const sorted = [...wallets].sort((a, b) => b.balance - a.balance);
  const tone = (i: number) => TONES[i % TONES.length];
  const many = sorted.length > 1 && total > 0;

  const add = () => sheet.show({ name: "", kind: "bank", balance: "" });
  const edit = (w: Wallet) =>
    sheet.show({ id: w.id, name: w.name, kind: w.kind, balance: w.balance ? minorToInput(w.balance) : "" });

  return (
    <section
      aria-label="Nakit varlıklarım"
      className={cn("rise rounded-3xl border border-line bg-surface p-4 shadow-[0_12px_32px_-20px_rgb(0_0_0/0.35)] sm:p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
            <span className="grid size-7 place-items-center rounded-lg bg-income-fill/15 text-income">
              <WalletIcon size={15} />
            </span>
            Nakit varlıklarım
          </p>
          {wallets.length > 0 ? (
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-sm text-ink-3">Toplam</span>
              <CountUpMoney
                id="cash-total"
                minor={total}
                currency={currency}
                fracClassName="opacity-40"
                className="text-[1.75rem] font-semibold leading-none tracking-tight sm:text-3xl"
              />
            </p>
          ) : (
            <p className="mt-2 max-w-xs text-sm text-ink-2">
              Banka hesaplarını ve nakdini ekle; hangisinde ne kadar paran olduğunu burada gör.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={add}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-bg/60 px-3.5 text-xs font-semibold shadow-sm transition-colors hover:bg-surface-2"
        >
          <Plus size={15} /> Hesap ekle
        </button>
      </div>

      {many && (
        <div className="mt-4 flex h-2.5 gap-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          {sorted.map((w, i) =>
            w.balance > 0 ? (
              <span key={w.id} className={cn("h-full rounded-full", tone(i))} style={{ flexGrow: w.balance }} />
            ) : null,
          )}
        </div>
      )}

      {sorted.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-2">
          {sorted.map((w, index) => (
            <li key={w.id} className={cn("min-w-0", !expanded && index >= MOBILE_ROWS && "hidden")}>
              <button
                type="button"
                aria-label={`${w.name}: düzenle`}
                onClick={() => edit(w)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2/40 p-3 text-left transition-colors hover:bg-surface-2 active:bg-surface-2"
              >
                <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-income-fill/15 text-lg">
                  {walletKind(w.kind).emoji}
                  {many && (
                    <span className={cn("absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-surface", tone(index))} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{w.name}</span>
                  <span className="block truncate text-[11px] text-ink-3">
                    {walletKind(w.kind).label} · {updatedText(w.updated_ms)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <Money minor={w.balance} currency={currency} fracClassName="opacity-40" className="text-sm font-semibold" />
                  {many && <span className="num block text-[10px] text-ink-3">%{Math.round((w.balance / total) * 100)}</span>}
                </span>
                <ChevronRight size={15} className="shrink-0 text-ink-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {sorted.length > MOBILE_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-2 w-full rounded-xl py-2 text-xs font-medium text-ink-2 hover:bg-surface-2"
        >
          {expanded ? "Daha az göster" : `Tümünü göster (${sorted.length - MOBILE_ROWS} hesap daha)`}
        </button>
      )}

      {sheet.item && (
        <WalletEditor initial={sheet.item} open={sheet.open} onClose={sheet.close} onExited={sheet.exited} />
      )}
    </section>
  );
}

type WalletDraft = { id?: string; name: string; kind: WalletKind; balance: string };

function WalletEditor({
  initial,
  open,
  onClose,
  onExited,
}: {
  initial: WalletDraft;
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}) {
  const { currency } = useApp();
  const toast = useToast();
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Boş ya da sıfır → 0 (ör. kartın borcu kapandı); aksi halde geçerli bir tutar olmalı.
  const raw = d.balance.trim();
  const balance = !raw || /^0+([.,]0*)?$/.test(raw) ? 0 : toMinor(raw);

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
    if (!d.name.trim()) return setError("Bir ad ver (ör. Garanti, Cüzdan).");
    if (balance === null) return setError("Geçerli bir tutar gir (ör. 12.500,00).");
    haptic("success");
    run(
      () => saveWallet({ id: d.id, name: d.name, kind: d.kind, balance }),
      d.id ? `${d.name.trim()} güncellendi` : `${d.name.trim()} eklendi`,
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={d.id ? "Hesabı düzenle" : "Hesap ekle"}
      footer={
        <div className="flex gap-2 pb-1">
          {d.id && (
            <ConfirmButton
              disabled={pending}
              confirmText="Sil"
              onConfirm={() => run(() => deleteWallet(d.id!), `${initial.name} silindi`)}
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
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tür">
          {WALLET_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={d.kind === k.kind}
              onClick={() => {
                haptic("select");
                setD((x) => ({ ...x, kind: k.kind }));
              }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center text-xs leading-tight transition-all",
                d.kind === k.kind ? "border-ink bg-surface-2 font-semibold" : "border-line text-ink-2 hover:bg-surface-2",
              )}
            >
              <span className="text-lg" aria-hidden>
                {k.emoji}
              </span>
              {k.label}
            </button>
          ))}
        </div>

        <Field label="Ad">
          <input
            className="input"
            placeholder={d.kind === "cash" ? "ör. Cüzdan" : "ör. A Bankası"}
            maxLength={40}
            value={d.name}
            autoFocus={!d.id}
            onChange={(e) => {
              setError(null);
              setD((x) => ({ ...x, name: e.target.value }));
            }}
          />
        </Field>

        <Field
          label="Güncel bakiye"
          hint="Değiştikçe buradan güncelleyebilirsin."
        >
          <span className="relative block">
            <input
              className={cn("input num pr-12 text-lg", balance === null && "border-expense")}
              inputMode="decimal"
              placeholder="0,00"
              value={d.balance}
              autoFocus={Boolean(d.id)}
              onChange={(e) => {
                setError(null);
                setD((x) => ({ ...x, balance: e.target.value }));
              }}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">{currency}</span>
          </span>
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
