"use client";

import { ChevronDown, Pencil, Plus, Settings2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildPortfolio,
  EMPTY,
  plClass,
  realizedRate,
  saleProfit,
  type Ipo,
  type IpoAccount,
  type IpoAllocation,
  type IpoSale,
  type Portfolio,
  type Stats,
} from "@/lib/ipo";
import { dayMonthShort } from "@/lib/dates";
import { moneyParts } from "@/lib/money";
import { useApp } from "@/components/app-context";
import { PageHeader } from "@/components/page-header";
import { useSheetState } from "@/components/sheet";
import { cn, Money } from "@/components/ui";
import { AccountsSheet, IpoEditor, PriceEditor, SaleEditor, type SaleTarget } from "./ipo-sheets";

export type IpoData = {
  accounts: IpoAccount[];
  ipos: Ipo[];
  allocations: IpoAllocation[];
  sales: IpoSale[];
};

type SheetState =
  | { kind: "accounts" }
  | { kind: "ipo"; ipo?: Ipo }
  | { kind: "price"; ipo: Ipo }
  | ({ kind: "sale" } & SaleTarget);

const num = new Intl.NumberFormat("tr-TR");
const two = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Kuruşu sembolsüz, iki ondalıklı fiyata çevirir: 3520 → "35,20" */
const price2 = (minor: number) => two.format(minor / 100);
const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });


export function IpoView({ data }: { data: IpoData }) {
  const { currency } = useApp();
  const sheet = useSheetState<SheetState>();
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | "open" | "closed">("all");

  const portfolio = useMemo(
    () => buildPortfolio(data.ipos, data.allocations, data.sales),
    [data.ipos, data.allocations, data.sales],
  );
  const headline = accountFilter ? (portfolio.byAccount.get(accountFilter) ?? EMPTY) : portfolio.total;
  const filterName = data.accounts.find((a) => a.id === accountFilter)?.name;

  const visible = data.ipos.filter((ipo) => {
    const s = accountFilter ? portfolio.cells.get(ipo.id)?.get(accountFilter)?.stats : portfolio.byIpo.get(ipo.id);
    if (accountFilter && !s) return false;
    if (status === "open") return (s?.remainingLots ?? 0) > 0;
    if (status === "closed") return Boolean(s && s.lots > 0 && s.remainingLots === 0);
    return true;
  });

  const noAccounts = data.accounts.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-5 lg:px-10">
      <PageHeader
        eyebrow="Portföy"
        title="Halka arz"
        action={
          !noAccounts && (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost h-11 px-4"
                onClick={() => sheet.show({ kind: "accounts" })}
                aria-label="Hesapları yönet"
              >
                <Settings2 size={17} /> <span className="hidden sm:inline">Hesaplar</span>
              </button>
              <button type="button" className="btn btn-primary h-11" onClick={() => sheet.show({ kind: "ipo" })}>
                <Plus size={18} /> Halka arz
              </button>
            </div>
          )
        }
      />

      {noAccounts ? (
        <SetupCard onStart={() => sheet.show({ kind: "accounts" })} />
      ) : (
        <>
          <Summary stats={headline} currency={currency} scope={filterName} ipoCount={data.ipos.length} />

          <div className="no-scrollbar -mx-5 mt-8 flex snap-x gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0">
            {data.accounts.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                stats={portfolio.byAccount.get(a.id) ?? EMPTY}
                currency={currency}
                active={accountFilter === a.id}
                onClick={() => setAccountFilter(accountFilter === a.id ? null : a.id)}
              />
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", "Tümü"],
                ["open", "Elde olanlar"],
                ["closed", "Satılıp kapananlar"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" className="chip" aria-pressed={status === k} onClick={() => setStatus(k)}>
                {label}
              </button>
            ))}
            {filterName && (
              <button type="button" className="chip border-ink text-ink" onClick={() => setAccountFilter(null)}>
                {filterName} ✕
              </button>
            )}
          </div>

          {data.ipos.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
              <p className="font-serif text-2xl">Henüz halka arz yok.</p>
              <p className="mt-1 text-sm text-ink-2">Katıldığın ilk halka arzı ekle; hesap hesap lotlarını gir.</p>
              <button type="button" onClick={() => sheet.show({ kind: "ipo" })} className="btn btn-primary mt-6">
                <Plus size={18} /> İlk halka arzı ekle
              </button>
            </div>
          ) : visible.length === 0 ? (
            <p className="mt-10 text-center text-sm text-ink-3">Bu filtreye uyan halka arz yok.</p>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {visible.map((ipo) => (
                <IpoCard
                  key={ipo.id}
                  ipo={ipo}
                  accounts={data.accounts}
                  portfolio={portfolio}
                  accountFilter={accountFilter}
                  currency={currency}
                  onEdit={() => sheet.show({ kind: "ipo", ipo })}
                  onPrice={() => sheet.show({ kind: "price", ipo })}
                  onSale={(target) => sheet.show({ kind: "sale", ...target })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {sheet.item?.kind === "accounts" && (
        <AccountsSheet
          accounts={data.accounts}
          allocations={data.allocations}
          open={sheet.open}
          onClose={sheet.close}
          onExited={sheet.exited}
        />
      )}
      {sheet.item?.kind === "ipo" && (
        <IpoEditor
          ipo={sheet.item.ipo}
          accounts={data.accounts}
          allocations={data.allocations}
          sales={data.sales}
          open={sheet.open}
          onClose={sheet.close}
          onExited={sheet.exited}
          onManageAccounts={() => sheet.show({ kind: "accounts" })}
        />
      )}
      {sheet.item?.kind === "price" && (
        <PriceEditor ipo={sheet.item.ipo} open={sheet.open} onClose={sheet.close} onExited={sheet.exited} />
      )}
      {sheet.item?.kind === "sale" && (
        <SaleEditor target={sheet.item} open={sheet.open} onClose={sheet.close} onExited={sheet.exited} />
      )}
    </div>
  );
}

function SetupCard({ onStart }: { onStart: () => void }) {
  return (
    <div className="rise mt-10 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2">
        <Wallet size={24} className="text-ink-2" />
      </span>
      <p className="mt-5 font-serif text-3xl tracking-tight">Halka arz defterini kur.</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-2">
        Önce katılım yaptığın hesapları ekle (ör. “Ahmet · Garanti”, “Eşim · Ziraat”). Sonra her halka arzda
        hangi hesaba kaç lot geldiğini gir.
      </p>
      <button type="button" onClick={onStart} className="btn btn-primary mt-6">
        <Plus size={18} /> Hesaplarımı ekle
      </button>
    </div>
  );
}

function Summary({
  stats,
  currency,
  scope,
  ipoCount,
}: {
  stats: Stats;
  currency: string;
  scope?: string;
  ipoCount: number;
}) {
  const p = moneyParts(stats.openValue, currency);
  const rate = realizedRate(stats);
  return (
    <section className="rise mt-8" aria-label="Portföy özeti">
      <p className="eyebrow">{scope ? `${scope} · ` : ""}portföy değeri · eldeki lotlar</p>
      <p className="mt-3 flex items-start font-serif text-[clamp(3.5rem,15vw,7rem)] leading-[0.85] tracking-[-0.03em]">
        <span className="mr-[0.04em] mt-[0.08em] font-sans text-[0.3em] font-light text-ink-3">{p.symbol}</span>
        <span className="italic">{p.int}</span>
        <span className="num ml-[0.06em] mt-[0.1em] text-[0.24em] not-italic text-ink-3">,{p.frac}</span>
      </p>

      <dl className="mt-7 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
        <SumStat label="Satışlardan kâr/zarar">
          <Money minor={stats.realized} currency={currency} sign className={cn("font-medium", plClass(stats.realized))} />
          {rate !== null && <span className={cn("num ml-1.5 text-xs", plClass(stats.realized))}>{pct.format(rate)}</span>}
        </SumStat>
        <SumStat label="Eldekiler (tahmini)">
          <Money minor={stats.unrealized} currency={currency} sign className={plClass(stats.unrealized)} />
        </SumStat>
        <SumStat label="Toplam (satış + elde)">
          <Money minor={stats.total} currency={currency} sign className={plClass(stats.total)} />
        </SumStat>
        <SumStat label="Toplam yatırılan">
          <Money minor={stats.cost} currency={currency} />
        </SumStat>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        Satışlardan kâr/zarar = (satış fiyatı − arz fiyatı) × satılan lot
        {stats.soldLots > 0 && " (girildiyse komisyon düşülür)"}. Eldekiler, girdiğin güncel fiyattan tahmindir.
      </p>
      <p className="mt-2 text-xs text-ink-3">
        {num.format(ipoCount)} halka arz · {num.format(stats.lots)} lot alındı · {num.format(stats.soldLots)} satıldı ·{" "}
        {num.format(stats.remainingLots)} elde
      </p>
    </section>
  );
}

function SumStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1.5 truncate text-[15px] sm:text-base">{children}</dd>
    </div>
  );
}

function AccountCard({
  account,
  stats,
  currency,
  active,
  onClick,
}: {
  account: IpoAccount;
  stats: Stats;
  currency: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "card w-48 shrink-0 snap-start p-4 text-left transition-colors",
        active ? "border-ink bg-ink text-bg" : "hover:bg-surface-2",
      )}
    >
      <p className="truncate text-sm font-medium">{account.name}</p>
      <p className="mt-3 text-[10px] uppercase tracking-[0.1em] opacity-60">Elde</p>
      <Money minor={stats.openValue} currency={currency} className="text-lg" />
      <p className="mt-2 flex items-baseline justify-between text-xs">
        <span className="opacity-60">Satıştan K/Z</span>
        <Money
          minor={stats.realized}
          currency={currency}
          sign
          className={cn(!active && plClass(stats.realized))}
        />
      </p>
    </button>
  );
}

function IpoCard({
  ipo,
  accounts,
  portfolio,
  accountFilter,
  currency,
  onEdit,
  onPrice,
  onSale,
}: {
  ipo: Ipo;
  accounts: IpoAccount[];
  portfolio: Portfolio;
  accountFilter: string | null;
  currency: string;
  onEdit: () => void;
  onPrice: () => void;
  onSale: (t: SaleTarget) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const cells = portfolio.cells.get(ipo.id);
  const rows = accounts.filter((a) => cells?.has(a.id) && (!accountFilter || a.id === accountFilter));
  const stats = accountFilter ? (cells?.get(accountFilter)?.stats ?? EMPTY) : (portfolio.byIpo.get(ipo.id) ?? EMPTY);
  const change = ipo.current_price !== null ? ipo.current_price / ipo.offer_price - 1 : null;

  return (
    <article className="card rise overflow-hidden">
      <header className="flex items-start gap-3 px-5 pt-5">
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2">
            <span className="num text-xl font-semibold tracking-tight">{ipo.code}</span>
            {ipo.name && <span className="truncate text-sm text-ink-2">{ipo.name}</span>}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
            <span>
              Arz <Money minor={ipo.offer_price} currency={currency} className="text-ink-2" />
            </span>
            {ipo.listed_on && <span>· {dayMonthShort(ipo.listed_on)}</span>}
            <button
              type="button"
              onClick={onPrice}
              className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-ink-2 hover:text-ink"
              title="Güncel fiyatı değiştir"
            >
              {ipo.current_price !== null ? (
                <>
                  Güncel <Money minor={ipo.current_price} currency={currency} className="text-ink" />
                  <span className={cn("num", plClass(change ?? 0))}>{pct.format(change ?? 0)}</span>
                </>
              ) : (
                "Güncel fiyat gir"
              )}
              <Pencil size={10} />
            </button>
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
          aria-label={`${ipo.code} düzenle`}
        >
          <Pencil size={15} />
        </button>
      </header>

      {rows.length === 0 ? (
        <p className="px-5 py-5 text-sm text-ink-3">Bu halka arzda hiçbir hesaba lot girilmemiş.</p>
      ) : (
        <ul className="mt-3">
          {rows.map((a) => {
            const cell = cells!.get(a.id)!;
            const s = cell.stats;
            const expanded = open === a.id;
            return (
              <li key={a.id} className="border-t border-line">
                <div className="flex items-center gap-3 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : a.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={expanded}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.name}</span>
                      <span className="num block text-xs text-ink-3">
                        {num.format(s.lots)} lot · <Money minor={s.cost} currency={currency} />
                        {s.soldLots > 0 && (
                          <span className="whitespace-nowrap"> · {num.format(s.remainingLots)} elde</span>
                        )}
                      </span>
                    </span>
                    <span className="text-right">
                      {s.soldLots > 0 ? (
                        <>
                          <span className="block text-[10px] uppercase tracking-[0.08em] text-ink-3">satıştan</span>
                          <Money
                            minor={s.realized}
                            currency={currency}
                            sign
                            className={cn("block text-sm font-medium", plClass(s.realized))}
                          />
                        </>
                      ) : (
                        <span className="block text-xs text-ink-3">satış yok</span>
                      )}
                      {s.remainingLots > 0 && ipo.current_price !== null && s.unrealized !== 0 && (
                        <span className="block text-[11px] text-ink-3">
                          elde ≈ <Money minor={s.unrealized} currency={currency} sign />
                        </span>
                      )}
                      {cell.sales.length > 0 && (
                        <span className="flex items-center justify-end gap-0.5 text-[11px] text-ink-3">
                          {cell.sales.length} satış
                          <ChevronDown size={12} className={cn("transition-transform", expanded && "rotate-180")} />
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={s.remainingLots === 0}
                    onClick={() =>
                      onSale({ ipo, account: a, allocation: cell.alloc, remaining: s.remainingLots })
                    }
                    className="btn btn-ghost h-9 shrink-0 px-3 text-xs disabled:opacity-30"
                  >
                    Sat
                  </button>
                </div>

                {expanded && cell.sales.length > 0 && (
                  <ul className="rise space-y-0.5 bg-surface-2/50 px-5 py-2">
                    {cell.sales.map((sale) => (
                      <li key={sale.id}>
                        <button
                          type="button"
                          onClick={() =>
                            onSale({
                              ipo,
                              account: a,
                              allocation: cell.alloc,
                              remaining: s.remainingLots + sale.lots,
                              sale,
                            })
                          }
                          className="block w-full rounded-lg py-1.5 text-left text-xs hover:text-ink"
                        >
                          <span className="flex items-baseline gap-2">
                            <span className="num shrink-0 text-ink-3">{dayMonthShort(sale.sold_on)}</span>
                            <span className="num text-ink-2">{num.format(sale.lots)} lot satıldı</span>
                            <span className="leader" />
                            <Money
                              minor={saleProfit(sale, ipo.offer_price)}
                              currency={currency}
                              sign
                              className={cn("shrink-0 font-medium", plClass(saleProfit(sale, ipo.offer_price)))}
                            />
                          </span>
                          {/* Formül açıkça: (satış − arz) × lot [− komisyon] */}
                          <span className="num mt-0.5 block text-[11px] text-ink-3">
                            ({price2(sale.price)} − {price2(ipo.offer_price)}) × {num.format(sale.lots)}
                            {sale.commission > 0 && ` − ${price2(sale.commission)} kom.`}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {(rows.length > 1 || stats.soldLots > 0) && (
        <footer className="border-t border-line bg-surface-2/60 px-5 py-3 text-sm">
          <p className="flex items-baseline justify-between">
            <span className="text-ink-2">
              Satıştan K/Z{" "}
              <span className="num text-xs text-ink-3">
                · {num.format(stats.soldLots)}/{num.format(stats.lots)} lot satıldı
              </span>
            </span>
            <span>
              <Money minor={stats.realized} currency={currency} sign className={cn("font-medium", plClass(stats.realized))} />
              {realizedRate(stats) !== null && (
                <span className={cn("num ml-1.5 text-xs", plClass(stats.realized))}>
                  {pct.format(realizedRate(stats)!)}
                </span>
              )}
            </span>
          </p>
          {stats.remainingLots > 0 && ipo.current_price !== null && (
            <p className="mt-1 flex items-baseline justify-between text-xs text-ink-3">
              <span>Eldeki {num.format(stats.remainingLots)} lot (güncel fiyatla, tahmini)</span>
              <Money minor={stats.unrealized} currency={currency} sign className={plClass(stats.unrealized)} />
            </p>
          )}
        </footer>
      )}
    </article>
  );
}
