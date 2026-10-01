"use client";

import { CalendarClock, CircleAlert } from "lucide-react";
import { dayMonth, shiftDate, weekdayName } from "@/lib/dates";
import { groupPayments, type Payment } from "@/lib/payments";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { AppIcon } from "@/components/category-icon";
import { PayButton } from "@/components/ledger/pay-button";
import { PageHeader } from "@/components/page-header";
import { cn, Money, PendingAmount } from "@/components/ui";

const ORIGIN: Record<Payment["origin"], string> = {
  loan: "Kredi taksiti",
  template: "Şablondan",
  recurring: "Düzenli",
  reminder: "Hatırlatmalı",
  planned: "Planlı",
};

function daysText(date: string, today: string) {
  const d = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  if (d === 0) return "bugün";
  if (d === 1) return "yarın";
  if (d === -1) return "dün";
  return d > 0 ? `${d} gün sonra` : `${-d} gün geçti`;
}

/** Yaklaşan ve gecikmiş ödemeler: gruplu liste, her biri ✓ ile ödendi işaretlenebilir. */
export function PaymentsView({ payments, today }: { payments: Payment[]; today: string }) {
  const { currency, categoryById } = useApp();
  const groups = groupPayments(payments, today);
  const in30 = shiftDate(today, 30);
  const next30 = payments.filter((p) => !p.overdue && p.date <= in30);
  const total30 = next30.reduce((s, p) => s + (p.amount ?? 0), 0);
  const overdue = payments.filter((p) => p.overdue);
  const overdueSum = overdue.reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl px-5 lg:px-10">
      <PageHeader eyebrow="Takvim" title="Yaklaşan ödemeler">
        Kredi taksitleri, düzenli ödemeler, şablon kalemleri ve hatırlatmalı giderler: önümüzdeki 60 gün.
      </PageHeader>

      {/* Özet */}
      <section className="rise mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
            <CalendarClock size={14} /> Önümüzdeki 30 gün
          </p>
          <Money minor={total30} currency={currency} fracClassName="opacity-40" className="mt-1.5 block text-2xl font-semibold" />
          <p className="text-xs text-ink-3">{next30.length} ödeme</p>
        </div>
        <div className={cn("rounded-2xl border p-4", overdue.length ? "border-expense/30 bg-expense/[0.06]" : "border-line bg-surface")}>
          <p className={cn("flex items-center gap-1.5 text-xs font-medium", overdue.length ? "text-expense" : "text-ink-3")}>
            <CircleAlert size={14} /> Gecikmiş
          </p>
          <Money
            minor={overdueSum}
            currency={currency}
            fracClassName="opacity-40"
            className={cn("mt-1.5 block text-2xl font-semibold", overdue.length > 0 && "text-expense")}
          />
          <p className="text-xs text-ink-3">{overdue.length ? `${overdue.length} ödeme` : "Gecikmiş ödeme yok"}</p>
        </div>
      </section>

      {groups.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-line p-8 text-center text-sm text-ink-2">
          Önümüzdeki 60 günde ödeme görünmüyor. Gider eklerken “Hatırlat”ı açtığın, düzenli ya da kredi taksiti olan
          ödemeler burada listelenir.
        </p>
      ) : (
        <div className="mt-8 space-y-7 pb-6">
          {groups.map((g) => (
            <section key={g.key} className="rise">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className={cn("text-sm font-semibold", g.key === "overdue" && "text-expense")}>{g.label}</h2>
                <Money
                  minor={g.items.reduce((s, p) => s + (p.amount ?? 0), 0)}
                  currency={currency}
                  fracClassName="opacity-40"
                  className="text-xs text-ink-3"
                />
              </div>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {g.items.map((p) => {
                  const cat = p.categoryId ? categoryById.get(p.categoryId) : undefined;
                  const name = p.note || cat?.name || UNCATEGORIZED.name;
                  return (
                    <li key={p.key} className="flex items-center gap-3 px-3 py-3">
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl",
                          p.overdue ? "bg-expense/12 text-expense" : "bg-surface-2 text-ink-2",
                        )}
                      >
                        <AppIcon name={cat?.emoji} size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{name}</span>
                        <span className="block text-xs leading-snug text-ink-3">
                          <span className="capitalize">{dayMonth(p.date)}</span> · {weekdayName(p.date)} ·{" "}
                          <span className={p.overdue ? "text-expense" : undefined}>{daysText(p.date, today)}</span> ·{" "}
                          {ORIGIN[p.origin]}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-sm font-semibold">
                        {p.amount === null ? (
                          <PendingAmount />
                        ) : (
                          <Money minor={p.amount} currency={currency} fracClassName="opacity-40" />
                        )}
                      </span>
                      {p.amount !== null && (
                        <PayButton
                          label={name}
                          target={
                            p.source === "once"
                              ? { type: "once", transactionId: p.id }
                              : { type: "recurring", recurringId: p.id, due: p.date }
                          }
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
