"use client";

import { Bitcoin, ChevronRight, Plus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { deleteCrypto, saveCrypto } from "@/lib/actions/crypto";
import {
  cryptoValue,
  normalizeSymbol,
  parseCryptoAmount,
  POPULAR_CRYPTO,
  priceText,
  unitPrice,
  type CryptoHolding,
  type CryptoPrice,
} from "@/lib/crypto";
import { haptic } from "@/lib/haptics";
import { plClass } from "@/lib/ipo";
import { minorToInput, toMinor } from "@/lib/money";
import { useApp } from "@/components/app-context";
import { ConfirmButton, Sheet, useSheetState } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { useAddRequest } from "@/components/assets/add-request";
import { cn, CountUpMoney, Field, Money, Spinner } from "@/components/ui";

/** Sembole göre sabit bir renk (her coin hep aynı renkte görünsün). */
const AVATAR_TONES = [
  "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
];
const toneFor = (symbol: string) =>
  AVATAR_TONES[[...symbol].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7) % AVATAR_TONES.length];

const qtyFmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 10 });
const pctFmt = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });

/** Kripto varlıklar: kullanıcı istediği coini ekler; güncel TL fiyatı otomatik ya da elle. */
export function CryptoCard({
  holdings,
  prices,
  liveAt,
  className,
}: {
  holdings: CryptoHolding[];
  prices: Record<string, CryptoPrice>;
  /** Son canlı fiyat sorgusunun zamanı (ms); yoksa null */
  liveAt?: number | null;
  className?: string;
}) {
  const { currency } = useApp();
  const sheet = useSheetState<CryptoDraft>();
  const rows = holdings
    .map((h) => ({ h, value: cryptoValue(h, prices) }))
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const total = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const withCost = rows.filter((r) => r.h.cost !== null && r.value !== null);
  const costSum = withCost.reduce((s, r) => s + r.h.cost!, 0);
  const pl = withCost.reduce((s, r) => s + r.value!, 0) - costSum;

  const add = (preset?: { symbol: string; name: string }) =>
    sheet.show({ symbol: preset?.symbol ?? "", name: preset?.name ?? "", amount: "", manualPrice: "", cost: "" });
  useAddRequest("crypto", () => add());
  const edit = (h: CryptoHolding) =>
    sheet.show({
      id: h.id,
      symbol: h.symbol,
      name: h.name ?? "",
      amount: qtyFmt.format(h.amount),
      manualPrice: h.manual_price === null ? "" : qtyFmt.format(h.manual_price),
      cost: h.cost ? minorToInput(h.cost) : "",
    });

  return (
    <section
      aria-label="Kripto"
      className={cn("rise rounded-3xl border border-line bg-surface p-4 shadow-[0_12px_32px_-20px_rgb(0_0_0/0.35)] sm:p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-2">
            <span className="grid size-7 place-items-center rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-300">
              <Bitcoin size={15} />
            </span>
            Kripto
            {liveAt && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-income" title="Fiyatlar 30 saniyede bir yenilenir">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-income-fill opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-income-fill" />
                </span>
                Canlı
              </span>
            )}
          </p>
          {holdings.length > 0 ? (
            <>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-sm text-ink-3">Toplam</span>
                <CountUpMoney
                  id="crypto-total"
                  minor={total}
                  currency={currency}
                  fracClassName="opacity-40"
                  className="text-[1.75rem] font-semibold leading-none tracking-tight sm:text-3xl"
                />
              </p>
              {costSum > 0 && (
                <p className="mt-1 text-xs text-ink-3">
                  Maliyete göre{" "}
                  <Money minor={pl} currency={currency} sign className={cn("font-semibold", plClass(pl))} />{" "}
                  <span className={plClass(pl)}>({pctFmt.format(pl / costSum)})</span>
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 max-w-xs text-sm text-ink-2">
              İstediğin coini sembolüyle ekle (BTC, ETH, SOL…); güncel TL değeri otomatik hesaplanır.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => add()}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-bg/60 px-3.5 text-xs font-semibold shadow-sm transition-colors hover:bg-surface-2"
        >
          <Plus size={15} /> Kripto ekle
        </button>
      </div>

      {rows.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-2">
          {rows.map(({ h, value }) => {
            const price = unitPrice(h, prices);
            return (
              <li key={h.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => edit(h)}
                  aria-label={`${h.symbol}: düzenle`}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2/40 p-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full text-[11px] font-bold tracking-tight",
                      toneFor(h.symbol),
                    )}
                  >
                    {h.symbol.slice(0, 4)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {h.symbol}
                      {h.name && <span className="font-normal text-ink-3"> · {h.name}</span>}
                    </span>
                    <span className="num block truncate text-[11px] text-ink-3">
                      {qtyFmt.format(h.amount)} {h.symbol}
                      {h.manual_price !== null ? (
                        <> · {priceText(h.manual_price)} ₺ (elle)</>
                      ) : prices[h.symbol]?.usdt != null ? (
                        // USDT paritesi, ör. PI/USDT 0,09
                        <> · {h.symbol}/USDT {priceText(prices[h.symbol]!.usdt!)}</>
                      ) : (
                        price !== null && <> · {priceText(price)} ₺</>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {value !== null ? (
                      <Money minor={value} currency={currency} fracClassName="opacity-40" className="text-sm font-semibold" />
                    ) : (
                      <span className="block text-xs text-expense">fiyat yok</span>
                    )}
                    {value !== null && h.cost !== null ? (
                      <span className={cn("num block text-[10px]", plClass(value - h.cost))}>
                        {pctFmt.format((value - h.cost) / h.cost)}
                      </span>
                    ) : (
                      // Maliyet yoksa coinin son 24 saatlik değişimi
                      h.manual_price === null &&
                      prices[h.symbol]?.change != null && (
                        <span className={cn("num block text-[10px]", plClass(prices[h.symbol]!.change!))}>
                          {pctFmt.format(prices[h.symbol]!.change!)} · 24 sa
                        </span>
                      )
                    )}
                  </span>
                  <ChevronRight size={15} className="shrink-0 text-ink-3" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {rows.some((r) => r.value === null) && (
        <p className="mt-2 text-xs text-ink-3">
          “Fiyat yok” görünen coinin güncel fiyatı bulunamadı; dokunup birim fiyatını elle girebilirsin.
        </p>
      )}

      {sheet.item && (
        <CryptoEditor
          initial={sheet.item}
          prices={prices}
          open={sheet.open}
          onClose={sheet.close}
          onExited={sheet.exited}
        />
      )}
    </section>
  );
}

type CryptoDraft = { id?: string; symbol: string; name: string; amount: string; manualPrice: string; cost: string };

function CryptoEditor({
  initial,
  prices,
  open,
  onClose,
  onExited,
}: {
  initial: CryptoDraft;
  prices: Record<string, CryptoPrice>;
  open: boolean;
  onClose: () => void;
  onExited: () => void;
}) {
  const { currency } = useApp();
  const toast = useToast();
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const update = (patch: Partial<CryptoDraft>) => {
    setError(null);
    setD((x) => ({ ...x, ...patch }));
  };

  const symbol = normalizeSymbol(d.symbol);
  const amount = parseCryptoAmount(d.amount);
  const manualPrice = d.manualPrice.trim() ? parseCryptoAmount(d.manualPrice) : null;
  // Listede fiyatı olmayan (yeni) bir sembol yazılınca/seçilince fiyatı hemen sorulur.
  const [fetched, setFetched] = useState<Record<string, CryptoPrice>>({});
  useEffect(() => {
    if (!/^[A-Z0-9]{2,12}$/.test(symbol) || prices[symbol] || fetched[symbol]) return;
    let stopped = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kripto?s=${symbol}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const { prices: got } = (await res.json()) as { prices: Record<string, CryptoPrice> };
        if (!stopped) setFetched((f) => ({ ...f, ...got }));
      } catch {
        /* fiyat sonra, kaydedince çekilir */
      }
    }, 400);
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, [symbol, prices, fetched]);
  const live = prices[symbol] ?? fetched[symbol];
  const livePrice = live?.price ?? null;
  const price = manualPrice ?? livePrice;
  const value = amount && price ? Math.round(amount * price * 100) : null;

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
    if (!/^[A-Z0-9]{2,12}$/.test(symbol)) return setError("Coinin sembolünü yaz (ör. BTC).");
    if (!amount) return setError("Geçerli bir miktar gir (ör. 0,0153).");
    if (d.manualPrice.trim() && !manualPrice) return setError("Birim fiyat geçersiz.");
    const cost = d.cost.trim() ? toMinor(d.cost) : null;
    if (d.cost.trim() && !cost) return setError("Alış maliyeti geçersiz.");
    haptic("success");
    run(
      () => saveCrypto({ id: d.id, symbol, name: d.name, amount, manualPrice, cost }),
      d.id ? `${symbol} güncellendi` : `${symbol} eklendi`,
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onExited={onExited}
      title={d.id ? `${initial.symbol} düzenle` : "Kripto ekle"}
      footer={
        <div className="flex gap-2 pb-1">
          {d.id && (
            <ConfirmButton disabled={pending} confirmText="Sil" onConfirm={() => run(() => deleteCrypto(d.id!), `${initial.symbol} silindi`)}>
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
        {!d.id && (
          <div>
            <p className="eyebrow mb-2">Hızlı seç</p>
            <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
              {POPULAR_CRYPTO.map((c) => (
                <button
                  key={c.symbol}
                  type="button"
                  aria-pressed={symbol === c.symbol}
                  onClick={() => update({ symbol: c.symbol, name: c.name })}
                  className="chip h-8 shrink-0 px-3 text-xs"
                >
                  {c.symbol}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
          <Field label="Sembol">
            <input
              className="input uppercase"
              placeholder="BTC"
              maxLength={12}
              value={d.symbol}
              autoFocus={!d.id}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => update({ symbol: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Ad (isteğe bağlı)">
            <input
              className="input"
              placeholder="Bitcoin"
              maxLength={40}
              value={d.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </Field>
        </div>

        <Field label={`Miktar${symbol ? ` (${symbol})` : ""}`}>
          <input
            className={cn("input num text-lg", d.amount && !amount && "border-expense")}
            inputMode="decimal"
            placeholder="0,0153"
            value={d.amount}
            onChange={(e) => update({ amount: e.target.value })}
          />
        </Field>

        <p className="-mt-2 text-sm text-ink-2">
          {livePrice !== null ? (
            <>
              Güncel fiyat: <strong className="num">{priceText(livePrice)} ₺</strong>
              {live?.usdt != null && (
                <span className="text-ink-3">
                  {" "}
                  ({symbol}/USDT {priceText(live.usdt)})
                </span>
              )}
            </>
          ) : symbol ? (
            <>Güncel fiyat kaydedince otomatik çekilir; bulunamazsa aşağıya elle gir.</>
          ) : null}
          {value !== null && (
            <>
              {" "}
              · Değer <Money minor={value} currency={currency} className="font-semibold text-ink" />
            </>
          )}
        </p>

        <Field
          label="Birim fiyat (isteğe bağlı)"
          hint="Boş bırakırsan güncel fiyat kullanılır. Kendi fiyatını kullanmak ya da listede olmayan bir coin için gir."
        >
          <span className="relative block">
            <input
              className={cn("input num pr-12", d.manualPrice.trim() && !manualPrice && "border-expense")}
              inputMode="decimal"
              placeholder={livePrice !== null ? priceText(livePrice) : "0,00"}
              value={d.manualPrice}
              onChange={(e) => update({ manualPrice: e.target.value })}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-3">₺</span>
          </span>
        </Field>

        <Field label="Toplam alış maliyeti (isteğe bağlı)" hint="Girersen kâr/zararını gösteririz.">
          <span className="relative block">
            <input
              className="input num pr-12"
              inputMode="decimal"
              placeholder="0,00"
              value={d.cost}
              onChange={(e) => update({ cost: e.target.value })}
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
