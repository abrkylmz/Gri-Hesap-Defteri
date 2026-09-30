"use client";

import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteWallet, saveWallet } from "@/lib/actions/wallets";
import type { Holding, Rate } from "@/lib/assets";
import { haptic } from "@/lib/haptics";
import { minorToInput, toMinor } from "@/lib/money";
import { isDebt, WALLET_KINDS, walletKind, type Wallet, type WalletKind } from "@/lib/wallets";
import { useApp } from "@/components/app-context";
import { positions } from "@/components/assets/asset-strip";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, CountUpMoney, Field, Money, Spinner } from "@/components/ui";

/** Çubuk ve nokta renkleri: cüzdanlar grinin tonları, döviz/altın altın sarısı, halka arz yeşil. */
const WALLET_TONES = ["bg-ink", "bg-ink/60", "bg-ink/35", "bg-ink/20"];
/** Telefonda ilk bu kadar kalem görünür; gerisi "Tümünü göster" ile açılır. */
const MOBILE_ROWS = 4;
const GOLD_TONE = "bg-amber-400";
const IPO_TONE = "bg-income-fill";

type Item = {
  key: string;
  emoji: string;
  name: string;
  sub?: string;
  value: number;
  debt: boolean;
  tone?: string;
  href?: string;
  wallet?: Wallet;
};

const dayMs = 86_400_000;
function updatedText(ms: number) {
  const days = Math.floor((Date.now() - ms) / dayMs);
  if (days <= 0) return "bugün güncellendi";
  if (days === 1) return "dün güncellendi";
  if (days < 30) return `${days} gün önce güncellendi`;
  return `${Math.floor(days / 30)} ay önce güncellendi`;
}

/**
 * Ana ekrandaki "Varlıklarım": paranın nerede ne kadar durduğu tek kartta.
 * Elle girilen yerler (banka, nakit, kart borcu…) + döviz/altın birikimlerinin güncel değeri
 * + halka arzda eldeki lotlar − kalan kredi borcu.
 */
export function NetWorthCard({
  wallets,
  holdings,
  rates,
  ipoValue,
  loanDebt,
}: {
  wallets: Wallet[];
  holdings: Holding[];
  rates: Rate[];
  ipoValue: number;
  loanDebt: number;
}) {
  const { currency } = useApp();
  const sheet = useSheetState<WalletDraft>();
  const [expanded, setExpanded] = useState(false);
  const holdingsValue = positions(holdings, rates).reduce((s, p) => s + p.value, 0);

  let tone = 0;
  const items: Item[] = [
    ...wallets.map((w) => ({
      key: w.id,
      emoji: walletKind(w.kind).emoji,
      name: w.name,
      sub: `${walletKind(w.kind).label} · ${updatedText(w.updated_ms)}`,
      value: w.balance,
      debt: isDebt(w.kind),
      tone: isDebt(w.kind) ? undefined : WALLET_TONES[tone++ % WALLET_TONES.length],
      wallet: w,
    })),
    ...(holdingsValue > 0
      ? [{ key: "fx", emoji: "🪙", name: "Döviz & altın", sub: "güncel kurla", value: holdingsValue, debt: false, tone: GOLD_TONE, href: "/varliklar" }]
      : []),
    ...(ipoValue > 0
      ? [{ key: "ipo", emoji: "📊", name: "Halka arz", sub: "eldeki lotlar", value: ipoValue, debt: false, tone: IPO_TONE, href: "/halka-arz" }]
      : []),
    ...(loanDebt > 0
      ? [{ key: "loan", emoji: "🏠", name: "Kredi borcu", sub: "kalan taksitler", value: loanDebt, debt: true, href: "/kredi" }]
      : []),
  ];
  const assets = items.filter((i) => !i.debt);
  const assetTotal = assets.reduce((s, i) => s + i.value, 0);
  const debtTotal = items.filter((i) => i.debt).reduce((s, i) => s + i.value, 0);
  const net = assetTotal - debtTotal;
  // Büyükten küçüğe; borçlar en sonda.
  const sorted = [...items].sort((a, b) => Number(a.debt) - Number(b.debt) || b.value - a.value);

  const add = () => sheet.show({ name: "", kind: "bank", balance: "" });

  return (
    <section aria-label="Varlıklarım" className="rise card mt-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{debtTotal > 0 ? "Net varlık" : "Varlıklarım"}</p>
          {items.length > 0 ? (
            <CountUpMoney
              id="net-worth"
              minor={net}
              currency={currency}
              className={cn("mt-1 block text-2xl font-semibold sm:text-3xl", net < 0 && "text-expense")}
            />
          ) : (
            <p className="mt-1 text-sm text-ink-2">
              Paranın nerede durduğunu ekle: banka hesapları, nakit, birikim, kart borcu…
            </p>
          )}
          {debtTotal > 0 && (
            <p className="mt-0.5 text-xs text-ink-3">
              <Money minor={assetTotal} currency={currency} /> varlık −{" "}
              <Money minor={debtTotal} currency={currency} /> borç
            </p>
          )}
        </div>
        <button type="button" onClick={add} className="btn btn-ghost h-9 shrink-0 px-3 text-xs">
          <Plus size={15} /> Yer ekle
        </button>
      </div>

      {assetTotal > 0 && (
        <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {assets
            .filter((i) => i.value > 0)
            .sort((a, b) => b.value - a.value)
            .map((i) => (
              <span key={i.key} className={cn("h-full rounded-full", i.tone)} style={{ flexGrow: i.value }} />
            ))}
        </div>
      )}

      {sorted.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((i, index) => {
            const body = (
              <>
                <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-base">
                  {i.emoji}
                  {i.tone && <span className={cn("absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-surface", i.tone)} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{i.name}</span>
                  {i.sub && <span className="block truncate text-[11px] text-ink-3">{i.sub}</span>}
                </span>
                <span className="shrink-0 text-right">
                  <Money
                    minor={i.debt ? -i.value : i.value}
                    currency={currency}
                    className={cn("text-sm", i.debt && "text-expense")}
                  />
                  {!i.debt && assetTotal > 0 && (
                    <span className="num block text-[10px] text-ink-3">%{Math.round((i.value / assetTotal) * 100)}</span>
                  )}
                </span>
                {/* Ok yalnızca başka sayfaya gidenlerde; yine de yer ayrılır ki tutarlar hizalı dursun. */}
                <ChevronRight size={15} className={cn("shrink-0 text-ink-3", !i.href && "invisible")} aria-hidden />
              </>
            );
            const cls =
              "flex w-full items-center gap-3 rounded-xl px-1.5 py-2 text-left transition-colors hover:bg-surface-2 active:bg-surface-2";
            return (
              <li
                key={i.key}
                className={cn(
                  "min-w-0 border-t border-line first:border-t-0 sm:[&:nth-child(2)]:border-t-0 lg:[&:nth-child(3)]:border-t-0",
                  !expanded && index >= MOBILE_ROWS && "hidden sm:block",
                )}
              >
                {i.href ? (
                  <Link href={i.href} className={cls}>
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={cls}
                    aria-label={`${i.name}: düzenle`}
                    onClick={() =>
                      i.wallet &&
                      sheet.show({
                        id: i.wallet.id,
                        name: i.wallet.name,
                        kind: i.wallet.kind,
                        balance: i.wallet.balance ? minorToInput(i.wallet.balance) : "",
                      })
                    }
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {sorted.length > MOBILE_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-1 w-full rounded-xl py-2 text-xs font-medium text-ink-2 hover:bg-surface-2 sm:hidden"
        >
          {expanded ? "Daha az göster" : `Tümünü göster (${sorted.length - MOBILE_ROWS} kalem daha)`}
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
  const debt = isDebt(d.kind);
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
      title={d.id ? "Yeri düzenle" : "Yer ekle"}
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
            placeholder={d.kind === "cash" ? "ör. Cüzdan" : d.kind === "card" ? "ör. Bonus kart" : "ör. Garanti vadesiz"}
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
          label={debt ? "Güncel borç" : "Güncel bakiye"}
          hint={debt ? "Kartın ödenmemiş borcu; toplam varlıktan düşülür." : "Değiştikçe buradan güncelleyebilirsin."}
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
