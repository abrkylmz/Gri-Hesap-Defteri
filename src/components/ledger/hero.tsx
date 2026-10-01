"use client";

import { monthLabel } from "@/lib/dates";
import { moneyParts } from "@/lib/money";
import { cn, CountUpMoney, Money } from "@/components/ui";
import { useCountUp } from "@/components/use-count-up";

const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });

export function Hero({
  month,
  income,
  expense,
  net,
  currency,
}: {
  month: string;
  income: number;
  expense: number;
  net: number;
  currency: string;
}) {
  const shownNet = useCountUp(net, "hero-net");
  const p = moneyParts(shownNet, currency);
  // Rakam uzadıkça yazı küçülür: büyük tutarlar telefonda ekranı taşırmasın.
  // (Animasyon sırasında zıplamasın diye hedef değerin uzunluğuna göre.)
  const digits = moneyParts(net, currency).int.length;
  const heroSize = `clamp(2.75rem, ${Math.min(19, 112 / digits).toFixed(1)}vw, ${Math.min(8.75, 54 / digits).toFixed(2)}rem)`;
  const spentRatio = income > 0 ? expense / income : null;
  const savingsRate = income > 0 ? net / income : null;

  return (
    <section className="rise" aria-label="Aylık özet">
      <p className="eyebrow capitalize">{monthLabel(month)} · net durum</p>

      <h1
        className={cn(
          // keep-serif: hangi görünüm stili seçilirse seçilsin net durum Klasik'teki el yazısı fontla
          "keep-serif mt-3 flex max-w-full items-start font-serif leading-[0.82] tracking-[-0.03em]",
          p.negative && "text-expense",
        )}
        style={{ fontSize: heroSize }}
      >
        <span className="mr-[0.04em] mt-[0.08em] font-sans text-[0.3em] font-light text-ink-3">
          {(p.negative || shownNet > 0) && <span className="mr-[0.25em]">{p.negative ? "−" : "+"}</span>}
          {p.symbol}
        </span>
        <span className="italic tabular-nums">{p.int}</span>
        {/* Kuruş kısmı rakamın alt çizgisinde (üst köşede değil) */}
        <span className="num mb-[0.06em] ml-[0.04em] self-end text-[0.24em] not-italic leading-none text-ink-3">
          ,{p.frac}
        </span>
      </h1>

      <dl className="mt-7 grid grid-cols-3 gap-4 border-t border-line pt-4">
        <Stat label="Gelir" dot="bg-income-fill">
          <CountUpMoney id="hero-income" minor={income} currency={currency} />
        </Stat>
        <Stat label="Gider" dot="bg-expense">
          <CountUpMoney id="hero-expense" minor={expense} currency={currency} />
        </Stat>
        <Stat label="Tasarruf">
          <span className="num">{savingsRate === null ? "—" : pct.format(savingsRate)}</span>
        </Stat>
      </dl>

      {spentRatio !== null && (
        <div className="mt-5">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-expense transition-[width] duration-700 ease-out"
              style={{ width: `${Math.min(spentRatio, 1) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-2">
            {spentRatio <= 1 ? (
              <>
                Gelirinin harcanan kısmı: <strong className="num text-ink">{pct.format(spentRatio)}</strong>
              </>
            ) : (
              <>
                Gelirinden <Money minor={expense - income} currency={currency} className="text-expense" />{" "}
                fazla harcandı.
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}

function Stat({ label, dot, children }: { label: string; dot?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow flex items-center gap-1.5">
        {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
        {label}
      </dt>
      <dd className="mt-1.5 truncate text-[15px] sm:text-base">{children}</dd>
    </div>
  );
}
