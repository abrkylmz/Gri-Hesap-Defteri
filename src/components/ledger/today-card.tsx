"use client";

import Link from "next/link";
import { CalendarCheck, ChevronRight, CircleAlert } from "lucide-react";
import { todaySummary, type Payment } from "@/lib/payments";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { AppIcon } from "@/components/category-icon";
import { cn, Money, PendingAmount } from "@/components/ui";
import { PayButton } from "./pay-button";

const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Ana ekranın en üstü: bugünün tarihi, bugün ödenecekler (✓ ile ödenir) ve toplamı,
 * gecikmiş ödemeler varsa uyarı. Ayrıntı ve sonraki günler Ödemeler sayfasında.
 */
export function TodayCard({ payments }: { payments: Payment[] }) {
  const { currency, today, categoryById } = useApp();
  const s = todaySummary(payments, today);
  const d = new Date(`${today}T00:00:00Z`);
  const day = weekday.format(d);

  return (
    <section aria-label="Bugün" className="card rise overflow-hidden">
      <div className="flex items-center gap-4 p-4 sm:p-5">
        {/* Takvim yaprağı */}
        <div className="flex w-16 shrink-0 flex-col items-center overflow-hidden rounded-2xl border border-line bg-surface-2/60">
          <span className="w-full bg-expense py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white">
            {monthYear.format(d).split(" ")[0]}
          </span>
          <span className="num py-1 text-3xl font-semibold leading-none tracking-tight">{Number(today.slice(8))}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium capitalize text-ink-3">
            {day} · {monthYear.format(d)}
          </p>
          {s.dueToday.length > 0 ? (
            <>
              <p className="mt-0.5 text-sm text-ink-2">Bugün {s.dueToday.length} ödeme</p>
              <Money
                minor={s.todayTotal}
                currency={currency}
                fracClassName="opacity-40"
                className="mt-0.5 block text-2xl font-semibold leading-tight tracking-tight"
              />
            </>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink-2">
              <CalendarCheck size={16} className="text-income" /> Bugün ödenecek bir şey yok
            </p>
          )}
        </div>
        <Link
          href="/odemeler"
          className="flex shrink-0 items-center gap-0.5 self-start rounded-full px-2 py-1 text-xs text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          Tümü <ChevronRight size={14} />
        </Link>
      </div>

      {s.dueToday.length > 0 && (
        <ul className="border-t border-line px-2 py-1">
          {s.dueToday.map((p) => {
            const cat = p.categoryId ? categoryById.get(p.categoryId) : undefined;
            const name = p.note || cat?.name || UNCATEGORIZED.name;
            return (
              <li key={p.key} className="flex items-center gap-3 px-2 py-1.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
                  <AppIcon name={cat?.emoji} size={15} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                {p.amount === null ? (
                  <PendingAmount />
                ) : (
                  <Money minor={p.amount} currency={currency} className="shrink-0 whitespace-nowrap text-sm" />
                )}
                <PayButton
                  label={name}
                  target={
                    p.source === "once"
                      ? { type: "once", transactionId: p.id }
                      : { type: "recurring", recurringId: p.id, due: p.date }
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {s.overdue.length > 0 && (
        <Link
          href="/odemeler"
          className={cn(
            "flex items-center gap-3 border-t border-expense/25 bg-expense/[0.07] px-4 py-3 text-sm transition-colors hover:bg-expense/[0.12]",
          )}
        >
          <CircleAlert size={17} className="shrink-0 text-expense" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold text-expense">{s.overdue.length} gecikmiş ödeme</span>
            <span className="text-ink-2">
              {" · toplam "}
              <Money minor={s.overdueTotal} currency={currency} className="font-medium text-ink" />
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-expense" />
        </Link>
      )}
    </section>
  );
}
