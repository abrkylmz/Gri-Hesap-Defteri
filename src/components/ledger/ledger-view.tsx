"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { RecurringRow, Template, TransactionRow } from "@/lib/types";
import type { MonthTotal } from "@/lib/data";
import { addMonths, dateInMonth, dayMonth, daysInMonth, monthOf } from "@/lib/dates";
import { pace, summarize, upcomingRecurring } from "@/lib/ledger";
import type { Reminder } from "@/lib/reminders";
import { useApp } from "@/components/app-context";
import { CashCard } from "@/components/assets/cash-card";
import { RateTicker } from "@/components/assets/rate-ticker";
import type { AssetCode, Holding, Rate } from "@/lib/assets";
import type { Wallet } from "@/lib/wallets";
import { useTxSheet } from "@/components/tx-sheet";
import { cn, Money } from "@/components/ui";
import { Barcode } from "./barcode";
import { Breakdown } from "./breakdown";
import { Hero } from "./hero";
import { LedgerList } from "./ledger-list";
import { MonthRail } from "./month-rail";
import { Trend } from "./trend";
import { Reminders } from "./reminders";
import { Upcoming } from "./upcoming";
import { useSwipe } from "./use-swipe";

/** Ay değişiminde yeni görünümün hangi yönden gireceği (kaydırma/ok yönüne göre). */
let enterFrom: "left" | "right" | null = null;

const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });

export function LedgerView({
  month,
  today,
  transactions,
  trend,
  recurring,
  reminders,
  doneRuns,
  templates,
  rates,
  holdings,
  wallets,
  watch,
  homeCash,
}: {
  month: string;
  today: string;
  transactions: TransactionRow[];
  trend: MonthTotal[];
  recurring: RecurringRow[];
  reminders: Reminder[];
  /** Bu ay erken ödenmiş/işlenmiş düzenli dönemler ("id|YYYY-MM") */
  doneRuns: string[];
  templates: Template[];
  rates: Rate[];
  holdings: Holding[];
  wallets: Wallet[];
  /** Ana ekranda izlenen kurlar (null → varsayılan) */
  watch: AssetCode[] | null;
  /** Nakit varlıklar kartı ana ekranda gösterilsin mi (kullanıcı Varlıklar sayfasından açar) */
  homeCash: boolean;
}) {
  const router = useRouter();
  const { currency, ledger } = useApp();
  const showCash = homeCash && !ledger.shared;
  const { setDefaultDate } = useTxSheet();
  const [navigating, startNavigation] = useTransition();
  const [day, setDay] = useState<string | null>(null);
  const [catKey, setCatKey] = useState<string | null>(null);
  // Bu ay görünümü bir ay değişiminin sonucuysa, geldiği yönden kayarak girsin (bir kez).
  const [enter] = useState(() => {
    const dir = enterFrom;
    enterFrom = null;
    return dir;
  });

  const current = monthOf(today);
  const summary = useMemo(() => summarize(transactions, month), [transactions, month]);
  const upcoming = useMemo(
    () => (month === current ? upcomingRecurring(recurring, today, new Set(doneRuns)) : []),
    [month, current, recurring, today, doneRuns],
  );
  const prevExpense = trend[trend.length - 2]?.expense ?? 0;
  const p = pace(month, today, summary.expense, summary.daily, prevExpense);

  // Yeni kayıt varsayılan tarihi: seçili gün > bu ay ise bugün > geçmiş/gelecek ayda ayın son/ilk günü.
  useEffect(() => {
    const fallback =
      month === current ? null : month < current ? dateInMonth(month, daysInMonth(month)) : `${month}-01`;
    setDefaultDate(day ?? fallback);
    return () => setDefaultDate(null);
  }, [day, month, current, setDefaultDate]);

  const navigate = (m: string) => {
    if (m === month) return;
    enterFrom = m > month ? "right" : "left";
    startNavigation(() => router.push(m === current ? "/" : `/?ay=${m}`, { scroll: false }));
  };
  // Telefonda özet alanını sola kaydır → sonraki ay, sağa → önceki ay.
  const swipe = useSwipe(
    () => navigate(addMonths(month, 1)),
    () => navigate(addMonths(month, -1)),
  );

  // Uygulama simgesi rozeti: hatırlatma penceresindeki ödeme sayısı (destekleyen cihazlarda).
  useEffect(() => {
    if (month !== current) return;
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    const count = reminders.length;
    (count ? nav.setAppBadge?.(count) : nav.clearAppBadge?.())?.catch(() => {});
  }, [reminders.length, month, current]);

  const selectCategory = (key: string | null) => {
    setCatKey(key);
    if (key && window.matchMedia("(max-width: 1023px)").matches) {
      document.getElementById("defter")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 lg:px-10">
      {/* Nakit kartı yalnızca kullanıcı açtıysa (Varlıklar → Ana ekranda göster). Masaüstünde aşağıdaki
          sol sütunla (7/12) aynı genişlikte, kurlar sağında 2×2; kart yoksa kurlar tek sırada.
          Varlıklar kişiseldir: başkasının defterine bakarken nakit kartı gösterilmez. */}
      <div className="pt-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-10 lg:pt-8">
        <div className={showCash ? "lg:order-2 lg:col-span-5" : "lg:col-span-12"}>
          <RateTicker rates={rates} holdings={holdings} watch={watch} beside={showCash} />
        </div>
        {showCash && <CashCard wallets={wallets} className="mt-3 lg:order-1 lg:col-span-7 lg:mt-0" />}
      </div>
      {navigating && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden" role="progressbar" aria-label="Yükleniyor">
          <div className="h-full w-1/3 animate-[progress_900ms_ease-in-out_infinite] bg-ink" />
        </div>
      )}

      <div className="sticky top-0 z-30 -mx-5 bg-bg/85 px-3 py-2 backdrop-blur-xl lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pt-8 lg:backdrop-blur-none">
        <MonthRail month={month} current={current} onNavigate={navigate} />
      </div>

      <Reminders items={reminders} />

      <div
        className={cn(
          // grid-cols-1 = minmax(0, 1fr): telefonda sütun içeriğe göre genişleyip ekranı taşırmasın.
          "mt-6 grid grid-cols-1 gap-6 transition-opacity duration-200 lg:mt-10 lg:grid-cols-12 lg:gap-10",
          navigating && "pointer-events-none opacity-50",
          enter === "right" && "enter-from-right",
          enter === "left" && "enter-from-left",
        )}
      >
        <div
          className="touch-pan-y space-y-5 lg:col-span-7"
          {...swipe.handlers}
          style={
            swipe.dx
              ? { transform: `translateX(${swipe.dx}px)`, opacity: 1 - Math.min(0.4, Math.abs(swipe.dx) / 300) }
              : { transition: "transform 250ms, opacity 250ms" }
          }
        >
          <Hero
            month={month}
            income={summary.income}
            expense={summary.expense}
            net={summary.net}
            currency={currency}
          />

          <dl className="rise grid grid-cols-3 gap-2 [animation-delay:40ms]">
            <Insight label="Günlük ort.">
              <Money minor={p.dailyAverage} currency={currency} />
            </Insight>
            {p.projected !== null ? (
              <Insight label="Bu tempoyla ay sonu">
                <Money minor={p.projected} currency={currency} />
              </Insight>
            ) : (
              <Insight label="En yoğun gün">
                <span className="num">{p.busiest ? dayMonth(p.busiest.date) : "—"}</span>
              </Insight>
            )}
            <Insight label="Geçen aya göre">
              {p.changeVsPrev === null ? (
                <span className="num text-ink-3">—</span>
              ) : (
                <span className={cn("num", p.changeVsPrev > 0 ? "text-expense" : "text-income")}>
                  {pct.format(p.changeVsPrev)}
                </span>
              )}
            </Insight>
          </dl>

          <Barcode
            daily={summary.daily}
            today={today}
            selected={day}
            onSelect={setDay}
            currency={currency}
          />
          <Upcoming items={upcoming} net={summary.net} />
          <Breakdown categories={summary.categories} activeKey={catKey} onSelect={selectCategory} />
          <div className="hidden lg:block">
            <Trend trend={trend} month={month} currency={currency} onNavigate={navigate} />
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-8">
            <LedgerList
              transactions={transactions}
              month={month}
              templates={templates}
              day={day}
              catKey={catKey}
              onClearDay={() => setDay(null)}
              onClearCategory={() => setCatKey(null)}
            />
          </div>
        </div>

        <div className="lg:hidden">
          <Trend trend={trend} month={month} currency={currency} onNavigate={navigate} />
        </div>
      </div>
    </div>
  );
}

function Insight({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2/60 px-3 py-3">
      <dt className="truncate text-[10px] uppercase tracking-[0.1em] text-ink-3">{label}</dt>
      <dd className="mt-1 truncate text-sm">{children}</dd>
    </div>
  );
}
