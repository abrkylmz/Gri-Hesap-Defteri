"use client";

import { Pencil, Plus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { deleteHolding, saveHolding } from "@/lib/actions/holdings";
import { ASSET_BY_CODE, ASSETS, parseQuantity, valueOf, type AssetCode, type Holding, type Rate } from "@/lib/assets";
import { minorToInput, moneyParts, toMinor } from "@/lib/money";
import { plClass } from "@/lib/ipo";
import { useApp } from "@/components/app-context";
import { AssetStrip, positions } from "@/components/assets/asset-strip";
import { CashCard } from "@/components/assets/cash-card";
import { LimitsCard } from "@/components/assets/limits-card";
import type { CreditLimit } from "@/lib/limits";
import type { Wallet } from "@/lib/wallets";
import { AssetIcon, amountText, ChangePill, rateText } from "@/components/assets/asset-visuals";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Field, Money, Spinner } from "@/components/ui";
import { useCountUp } from "@/components/use-count-up";

type Draft = { id?: string; asset: AssetCode; amount: string; cost: string; note: string };

const timeFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const pctFmt = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
const qtyInput = (n: number) => String(n).replace(".", ",");

export function AssetsView({
  rates,
  holdings,
  openAdd,
  wallets,
  homeCash,
  limits,
}: {
  rates: Rate[];
  holdings: Holding[];
  openAdd: boolean;
  wallets: Wallet[];
  /** Nakit kartı ana ekranda mı */
  homeCash: boolean;
  limits: CreditLimit[];
}) {
  const { currency } = useApp();
  const sheet = useSheetState<Draft>();
  const rateBy = new Map(rates.map((r) => [r.code, r]));
  const pos = positions(holdings, rates);
  const total = pos.reduce((s, p) => s + p.value, 0);
  const withCost = holdings.filter((h) => h.cost !== null && rateBy.has(h.asset));
  const costSum = withCost.reduce((s, h) => s + h.cost!, 0);
  const costValue = withCost.reduce((s, h) => s + valueOf(h.amount, rateBy.get(h.asset)!.rate), 0);
  const pl = costValue - costSum;
  const updated = rates.reduce((m, r) => Math.max(m, r.updatedMs), 0);
  const big = moneyParts(useCountUp(total, "assets-total"), currency);
  const { show } = sheet;

  useEffect(() => {
    if (openAdd) show({ asset: "USD", amount: "", cost: "", note: "" });
  }, [openAdd, show]);

  return (
    <div className="mx-auto max-w-5xl px-5 lg:px-10">
      <PageHeader
        eyebrow="Birikim"
        title="Varlıklar"
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => show({ asset: "USD", amount: "", cost: "", note: "" })}
          >
            <Plus size={18} /> Döviz / altın ekle
          </button>
        }
      />

      {/* Nakit hesaplar (banka, cüzdan…) — ana ekranda gösterilip gösterilmeyeceği buradan seçilir */}
      {/* Masaüstünde nakit ve limitler yan yana */}
      <div className="mt-8 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <CashCard wallets={wallets} homeToggle={homeCash} />
        <LimitsCard limits={limits} />
      </div>

      <section className="rise mt-12" aria-label="Döviz ve altın toplamı">
        <p className="eyebrow">Döviz & altın · toplam değer</p>
        <p className="mt-3 flex items-start font-serif text-[clamp(3.25rem,14vw,6.5rem)] leading-[0.85] tracking-[-0.03em]">
          <span className="mr-[0.04em] mt-[0.08em] font-sans text-[0.3em] font-light text-ink-3">{big.symbol}</span>
          <span className="italic">{big.int}</span>
          <span className="num ml-[0.06em] mt-[0.1em] text-[0.24em] not-italic text-ink-3">,{big.frac}</span>
        </p>
        {withCost.length > 0 && (
          <p className="mt-3 text-sm text-ink-2">
            Alış maliyetine göre{" "}
            <Money minor={pl} currency={currency} sign className={cn("font-medium", plClass(pl))} />{" "}
            <span className={cn("num text-xs", plClass(pl))}>{pctFmt.format(costSum ? pl / costSum : 0)}</span>
            {withCost.length < holdings.length && <span className="text-xs text-ink-3"> (maliyeti girilenler)</span>}
          </p>
        )}
      </section>

      <div className="mt-6">
        <AssetStrip rates={rates} holdings={holdings} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Birikimlerim */}
        <section aria-label="Birikimlerim">
          <h2 className="font-serif text-3xl tracking-tight">Birikimlerim</h2>
          {holdings.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-line px-6 py-10 text-center">
              <p className="font-serif text-2xl">Henüz birikim yok.</p>
              <p className="mt-1 text-sm text-ink-2">Dolar, euro, gram ya da çeyrek altınını ekle; TL değeri her gün güncellenir.</p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
              {holdings.map((h) => {
                const def = ASSET_BY_CODE.get(h.asset)!;
                const rate = rateBy.get(h.asset);
                const value = rate ? valueOf(h.amount, rate.rate) : null;
                const hpl = value !== null && h.cost !== null ? value - h.cost : null;
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() =>
                        show({
                          id: h.id,
                          asset: h.asset,
                          amount: qtyInput(h.amount),
                          cost: h.cost ? minorToInput(h.cost) : "",
                          note: h.note ?? "",
                        })
                      }
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                    >
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br saturate-[0.8] brightness-[0.93]", def.theme)}>
                        <AssetIcon code={h.asset} size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {amountText(def, h.amount)} <span className="text-ink-3">· {def.short}</span>
                        </span>
                        <span className="block truncate text-xs text-ink-3">
                          {h.note ?? (h.cost ? "Maliyet girildi" : "Maliyet girilmedi")}
                        </span>
                      </span>
                      <span className="text-right">
                        {value !== null ? (
                          <Money minor={value} currency={currency} className="block text-sm font-medium" />
                        ) : (
                          <span className="block text-xs text-ink-3">kur yok</span>
                        )}
                        {hpl !== null && (
                          <Money minor={hpl} currency={currency} sign className={cn("block text-[11px]", plClass(hpl))} />
                        )}
                      </span>
                      <Pencil size={14} className="shrink-0 text-ink-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Güncel kurlar */}
        <section aria-label="Güncel kurlar">
          <h2 className="font-serif text-3xl tracking-tight">Güncel kurlar</h2>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {ASSETS.map((def) => {
              const r = rateBy.get(def.code);
              return (
                <li key={def.code} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br saturate-[0.8] brightness-[0.93]", def.theme)}>
                    <AssetIcon code={def.code} size={14} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">{def.label}</span>
                  {r ? (
                    <>
                      <ChangePill change={r.change} className={cn("bg-transparent", (r.change ?? 0) >= 0 ? "text-income" : "text-expense")} />
                      <span className="num w-28 text-right text-sm font-medium">{rateText(r.rate)}</span>
                    </>
                  ) : (
                    <span className="text-xs text-ink-3">alınamadı</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            Döviz: TCMB döviz satış kuru. Altın ve gümüş: Altınkaynak Kuyumculuk <strong>alış</strong> fiyatı,
            yani bozdurunca eline geçecek tutar.
            {updated > 0 && <> Son güncelleme: {timeFmt.format(updated)}.</>}
          </p>
        </section>
      </div>

      {sheet.item && (
        <HoldingEditor
          initial={sheet.item}
          rateBy={rateBy}
          open={sheet.open}
          onClose={sheet.close}
          onExited={sheet.exited}
        />
      )}
    </div>
  );
}

function HoldingEditor({
  initial,
  rateBy,
  open,
  onClose,
  onExited,
}: {
  initial: Draft;
  rateBy: Map<AssetCode, Rate>;
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}) {
  const { currency } = useApp();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState(initial);
  const def = ASSET_BY_CODE.get(d.asset)!;
  const amount = parseQuantity(d.amount);
  const rate = rateBy.get(d.asset);
  const value = amount && rate ? valueOf(amount, rate.rate) : null;

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, msg: string) =>
    startTransition(async () => {
      const res = await fn().catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı. Tekrar dene." }));
      if (!res.ok) return setError(res.error);
      toast(msg);
      onClose();
    });

  const save = () => {
    if (!amount) return setError("Geçerli bir miktar gir (ör. 1500 ya da 12,5).");
    const cost = d.cost.trim() ? toMinor(d.cost) : null;
    if (d.cost.trim() && !cost) return setError("Alış maliyeti geçersiz.");
    run(
      () => saveHolding({ id: d.id, asset: d.asset, amount, cost, note: d.note }),
      d.id ? "Birikim güncellendi" : "Birikim eklendi",
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={d.id ? "Birikimi düzenle" : "Varlık ekle"}
      footer={
        <div className="flex gap-2 pb-1">
          {d.id && (
            <ConfirmButton disabled={pending} confirmText="Sil" onConfirm={() => run(() => deleteHolding(d.id!), "Birikim silindi")}>
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
        <div className="grid grid-cols-3 gap-2">
          {ASSETS.map((a) => (
            <button
              key={a.code}
              type="button"
              onClick={() => setD((x) => ({ ...x, asset: a.code }))}
              aria-pressed={d.asset === a.code}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs transition-all",
                d.asset === a.code ? "border-ink bg-surface-2 font-semibold" : "border-line text-ink-2 hover:bg-surface-2",
              )}
            >
              <span className={cn("grid size-8 place-items-center rounded-full bg-gradient-to-br saturate-[0.8] brightness-[0.93]", a.theme)}>
                <AssetIcon code={a.code} size={15} />
              </span>
              {a.short}
            </button>
          ))}
        </div>

        <Field label={`Miktar (${def.kind === "currency" ? def.unit : def.unit === "gr" ? "gram" : "adet"})`}>
          <input
            className={cn("input num text-lg", d.amount && !amount && "border-expense")}
            inputMode="decimal"
            placeholder={def.kind === "currency" ? "1.500" : def.unit === "gr" ? "12,5" : "3"}
            value={d.amount}
            autoFocus={!d.id}
            onChange={(e) => setD((x) => ({ ...x, amount: e.target.value }))}
          />
        </Field>
        {value !== null && rate && (
          <p className="-mt-3 text-sm text-ink-2">
            ≈ <Money minor={value} currency={currency} className="font-medium text-ink" />{" "}
            <span className="text-xs text-ink-3">({rateText(rate.rate)} kuruyla)</span>
          </p>
        )}

        <Field label="Toplam alış maliyeti (isteğe bağlı)" hint="Girersen kâr/zararını gösteririz.">
          <div className="relative">
            <input
              className="input num pr-12"
              inputMode="decimal"
              placeholder="0,00"
              value={d.cost}
              onChange={(e) => setD((x) => ({ ...x, cost: e.target.value }))}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">{currency}</span>
          </div>
        </Field>

        <Field label="Not (isteğe bağlı)">
          <input
            className="input"
            placeholder="ör. Düğün altınları, kasada"
            maxLength={100}
            value={d.note}
            onChange={(e) => setD((x) => ({ ...x, note: e.target.value }))}
          />
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
