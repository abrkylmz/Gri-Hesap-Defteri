import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, dayMonth, dayMonthShort, monthLabel, monthOf, monthShort } from "@/lib/dates";
import { isBill } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { analyzeMonth, expectedNextMonth, itemize, WEEKDAYS, type MonthAnalysis } from "@/lib/report";
import { ReportOptions } from "./report-options";
import { PrintButton } from "./print-button";
import { AppIcon } from "@/components/category-icon";

import { Empty, fullDate, ItemList, Kpi, pct, ReportSection, SplitBar, Stat, Table } from "./report-parts";

import type { NetWorthPoint } from "@/lib/net-worth";
import type { CategoryRow, RecurringRow, TransactionRow } from "@/lib/types";

export type ReportData = {
  ownerName: string;
  shared: boolean;
  today: string;
  month: string;
  currency: string;
  autoPrint: boolean;
  transactions: TransactionRow[];
  previous: TransactionRow[];
  next: TransactionRow[];
  categories: CategoryRow[];
  trend: { month: string; income: number; expense: number }[];
  recurring: RecurringRow[];
  netHistory: NetWorthPoint[];
};

/** Aylık rapor görünümü (veri page.tsx'te çekilir). */
export function ReportView({
  ownerName,
  shared,
  today,
  month,
  currency,
  autoPrint,
  transactions,
  previous,
  next,
  categories,
  trend,
  recurring,
  netHistory,
}: ReportData) {
  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const cur = currency;
  const money = (minor: number, sign = false) => formatMoney(minor, cur, { sign });
  const catBy = new Map(categories.map((c) => [c.id, c]));
  const catName = (id: string | null) => (id ? (catBy.get(id)?.name ?? "Kategorisiz") : "Kategorisiz");
  const a = analyzeMonth({
    month,
    today,
    current: transactions,
    previous,
    trend,
    budgets: new Map(categories.map((c) => [c.id, c.monthly_budget])),
  });
  const s = a.summary;
  const savings = s.income > 0 ? s.net / s.income : null;
  const bills = transactions.filter((t) => isBill(t, today)).sort((x, y) => x.occurred_on.localeCompare(y.occurred_on));
  const expenseItems = itemize(transactions, "expense");
  const incomeItems = itemize(transactions, "income");
  const expected = month >= monthOf(today) ? expectedNextMonth(nextMonth, next, recurring) : null;
  const monthPoints = netHistory.filter((p) => monthOf(p.day) === month);
  const netStart = monthPoints[0];
  const netEnd = monthPoints.at(-1);
  const title = `${monthLabel(month)} raporu`;
  const insights = buildInsights(a, money, catName, prevMonth);

  return (
    <main className="report min-h-dvh bg-bg pb-16 print:bg-white print:pb-0">
      {/* Araç çubuğu (yazdırılmaz) */}
      <div className="no-print pt-safe sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] items-center gap-2 py-3 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
          <Link
            href={`/?ay=${month}`}
            className="-ml-2 flex h-10 items-center gap-1 rounded-full px-2 text-sm text-ink-2 hover:text-ink"
          >
            <ArrowLeft size={16} /> Defter
          </Link>
          <div className="mx-auto flex items-center gap-1">
            <Link
              href={`/rapor?ay=${prevMonth}`}
              className="grid size-9 place-items-center rounded-full hover:bg-surface-2"
              aria-label="Önceki ay"
            >
              <ChevronLeft size={17} />
            </Link>
            <span className="min-w-28 text-center text-sm font-medium capitalize">{monthLabel(month)}</span>
            <Link
              href={`/rapor?ay=${nextMonth}`}
              className="grid size-9 place-items-center rounded-full hover:bg-surface-2"
              aria-label="Sonraki ay"
            >
              <ChevronRight size={17} />
            </Link>
          </div>
          <PrintButton auto={autoPrint} fileTitle={`Gri - ${title}`} />
        </div>
        <div className="mx-auto max-w-[210mm] pb-3 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
          <ReportOptions incomeCount={incomeItems.count} expenseCount={expenseItems.count} />
        </div>
      </div>

      <article className="mx-auto mt-6 max-w-[210mm] rounded-3xl border border-line bg-surface p-6 text-ink sm:p-12 print:mt-0 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <BrandLogo height={32} />
            {shared && <p className="eyebrow mt-3">{ownerName} adlı kişinin defteri</p>}
            <h1 className="mt-2 font-serif text-4xl capitalize tracking-tight sm:text-5xl">{title}</h1>
          </div>
          <p className="text-right text-xs text-ink-3">
            Hazırlanma
            <br />
            {fullDate.format(new Date(`${today}T00:00:00Z`))}
          </p>
        </header>

        {/* Özet + geçen aya göre */}
        <section className="avoid-break mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Gelir" value={money(s.income)} tone="income" delta={a.income} money={money} />
          <Kpi label="Gider" value={money(s.expense)} tone="expense" delta={a.expense} money={money} invert />
          <Kpi
            label="Net"
            value={money(s.net, true)}
            tone={s.net < 0 ? "expense" : undefined}
            delta={a.net}
            money={money}
          />
          <Kpi label="Tasarruf oranı" value={savings === null ? "—" : pct.format(savings)} />
        </section>
        <p className="mt-2 text-[10px] text-ink-3">
          Kutulardaki küçük yazılar geçen aya ({monthLabel(prevMonth)}) göre değişimdir.
          {s.pendingAmounts > 0 && ` ${s.pendingAmounts} kaydın tutarı henüz girilmediği için toplamlara dahil değil.`}
        </p>

        {/* Öne çıkanlar */}
        {insights.length > 0 && (
          <ReportSection title="Ayın öne çıkanları">
            <ul className="avoid-break space-y-1.5 text-sm leading-relaxed text-ink-2">
              {insights.map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-3" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </ReportSection>
        )}

        {/* Günlük harcama */}
        {a.daily.dayCount > 0 && (
          <ReportSection title="Günlük harcama">
            <div className="avoid-break">
              <DailyChart days={a.daily.days} max={a.daily.maxDay?.amount ?? 0} />
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Günlük ortalama" value={money(a.daily.average)} />
                <Stat
                  label="En yüksek gün"
                  value={a.daily.maxDay ? money(a.daily.maxDay.amount) : "—"}
                  hint={a.daily.maxDay ? dayMonth(a.daily.maxDay.date) : undefined}
                />
                <Stat label="Harcamasız gün" value={`${a.daily.noSpendDays} / ${a.daily.dayCount}`} />
                <Stat label="Gider işlemi" value={String(a.daily.count)} />
              </div>
            </div>
          </ReportSection>
        )}

        {/* Kategoriler */}
        <ReportSection title="Kategorilere göre giderler">
          {a.categories.length === 0 ? (
            <Empty>Bu ay gider yok.</Empty>
          ) : (
            <Table
              head={["Kategori", "Pay", "Tutar", "Geçen ay", "Değişim", "Bütçe"]}
              align={["l", "l", "r", "r", "r", "r"]}
            >
              {a.categories.map((c) => (
                <tr key={c.key}>
                  <td>
                    <AppIcon
                      name={c.categoryId ? catBy.get(c.categoryId)?.emoji : "none"}
                      size={13}
                      className="mr-1.5 inline-block align-[-2px] text-ink-2"
                    />
                    {catName(c.categoryId)}
                    <span className="ml-1 text-ink-3">({c.count})</span>
                  </td>
                  <td className="w-[22%]">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className="block h-full rounded-full bg-expense"
                          style={{ width: `${Math.round(c.share * 100)}%` }}
                        />
                      </span>
                      <span className="w-8 text-right text-ink-3">{pct.format(c.share)}</span>
                    </span>
                  </td>
                  <td className="text-right font-medium">{money(c.total)}</td>
                  <td className="text-right text-ink-3">{c.prev ? money(c.prev) : "—"}</td>
                  <td
                    className={`text-right ${c.total > c.prev ? "text-expense" : c.total < c.prev ? "text-income" : "text-ink-3"}`}
                  >
                    {c.prev === 0 && c.total > 0 ? "yeni" : c.total === c.prev ? "—" : money(c.total - c.prev, true)}
                  </td>
                  <td className={`text-right ${c.budget && c.total > c.budget ? "text-expense" : "text-ink-3"}`}>
                    {c.budget
                      ? c.total > c.budget
                        ? `${money(c.total - c.budget)} aşıldı`
                        : `${money(c.budget - c.total)} kaldı`
                      : "—"}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </ReportSection>

        {/* Sabit / değişken + haftanın günleri */}
        {s.expense > 0 && (
          <section className="avoid-break mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="mb-3 font-serif text-2xl tracking-tight">Sabit ve değişken</h2>
              <SplitBar
                parts={[
                  { label: "Sabit (düzenli, taksit, şablon)", value: a.fixed, tone: "bg-ink-2" },
                  { label: "Değişken (günlük harcamalar)", value: a.variable, tone: "bg-expense" },
                ]}
                total={s.expense}
                money={money}
              />
            </div>
            <div>
              <h2 className="mb-3 font-serif text-2xl tracking-tight">Haftanın günleri</h2>
              <ul className="space-y-1.5 text-xs">
                {WEEKDAYS.map((d, i) => {
                  const v = a.weekdays[i]!;
                  const max = Math.max(...a.weekdays, 1);
                  return (
                    <li key={d} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-ink-2">{d}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className="block h-full rounded-full bg-expense/80"
                          style={{ width: `${(v / max) * 100}%` }}
                        />
                      </span>
                      <span className="num w-24 shrink-0 text-right">{v ? money(v) : "—"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {/* En büyük giderler */}
        {a.top.length > 0 && (
          <ReportSection title="En büyük giderler">
            <Table head={["Tarih", "Açıklama", "Kategori", "Tutar"]} align={["l", "l", "l", "r"]}>
              {a.top.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{dayMonthShort(t.occurred_on)}</td>
                  <td>{t.note || "—"}</td>
                  <td className="text-ink-2">{catName(t.category_id)}</td>
                  <td className="whitespace-nowrap text-right font-medium">{money(t.amount!)}</td>
                </tr>
              ))}
            </Table>
          </ReportSection>
        )}

        {/* Bütçe */}
        {a.budget && (
          <ReportSection title="Bütçe özeti">
            <div className="avoid-break grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Toplam bütçe" value={money(a.budget.total)} hint={`${a.budget.count} kategori`} />
              <Stat label="Harcanan" value={money(a.budget.spent)} hint={pct.format(a.budget.spent / a.budget.total)} />
              <Stat
                label={a.budget.spent > a.budget.total ? "Aşım" : "Kalan"}
                value={money(Math.abs(a.budget.total - a.budget.spent))}
                tone={a.budget.spent > a.budget.total ? "expense" : "income"}
              />
              <Stat
                label="Aşılan kategori"
                value={String(a.budget.over)}
                tone={a.budget.over ? "expense" : undefined}
              />
            </div>
          </ReportSection>
        )}

        {s.categories.income.length > 0 && (
          <ReportSection title="Gelirler">
            <Table head={["Kategori", "İşlem", "Tutar", "Pay"]} align={["l", "r", "r", "r"]}>
              {s.categories.income.map((c) => (
                <tr key={c.key}>
                  <td>{catName(c.categoryId)}</td>
                  <td className="text-right">{c.count}</td>
                  <td className="text-right font-medium">{money(c.total)}</td>
                  <td className="text-right text-ink-3">{pct.format(c.total / (s.income || 1))}</td>
                </tr>
              ))}
            </Table>
          </ReportSection>
        )}

        {/* Son 6 ay */}
        <ReportSection title="Son altı ay">
          <Table head={["Ay", "Gelir", "Gider", "Net", "Tasarruf"]} align={["l", "r", "r", "r", "r"]}>
            {trend.map((t) => (
              <tr key={t.month} className={t.month === month ? "font-semibold" : undefined}>
                <td className="capitalize">
                  {monthShort(t.month)} {t.month.slice(0, 4)}
                </td>
                <td className="text-right">{money(t.income)}</td>
                <td className="text-right">{money(t.expense)}</td>
                <td className={`text-right ${t.income - t.expense < 0 ? "text-expense" : ""}`}>
                  {money(t.income - t.expense, true)}
                </td>
                <td className="text-right text-ink-3">
                  {t.income > 0 ? pct.format((t.income - t.expense) / t.income) : "—"}
                </td>
              </tr>
            ))}
            {a.average.months > 0 && (
              <tr className="text-ink-3">
                <td>Önceki {a.average.months} ay ort.</td>
                <td className="text-right">{money(Math.round(a.average.income!))}</td>
                <td className="text-right">{money(Math.round(a.average.expense!))}</td>
                <td className="text-right">{money(Math.round(a.average.income! - a.average.expense!), true)}</td>
                <td />
              </tr>
            )}
          </Table>
        </ReportSection>

        {/* Net varlık */}
        {netStart && netEnd && (
          <ReportSection title="Net varlık">
            <div className="avoid-break grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label={`Ay başı (${dayMonthShort(netStart.day)})`}
                value={money(netStart.assets - netStart.debts)}
              />
              <Stat label={`Ay sonu (${dayMonthShort(netEnd.day)})`} value={money(netEnd.assets - netEnd.debts)} />
              <Stat
                label="Değişim"
                value={money(netEnd.assets - netEnd.debts - (netStart.assets - netStart.debts), true)}
                tone={netEnd.assets - netEnd.debts >= netStart.assets - netStart.debts ? "income" : "expense"}
              />
              <Stat label="Borçlar (ay sonu)" value={money(netEnd.debts)} />
            </div>
            <p className="mt-2 text-[10px] text-ink-3">
              Varlıklar sayfasının açıldığı günlerde kaydedilen değerlerden.
            </p>
          </ReportSection>
        )}

        {/* Ödemeler */}
        {bills.length > 0 && (
          <ReportSection title="Bu ayın ödemeleri">
            <Table head={["Tarih", "Ödeme", "Tür", "Tutar", "Durum"]} align={["l", "l", "l", "r", "r"]}>
              {bills.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{dayMonthShort(t.occurred_on)}</td>
                  <td>{t.note || catName(t.category_id)}</td>
                  <td className="text-ink-3">
                    {t.loan_id ? "Taksit" : t.recurring_id ? "Düzenli" : t.template_id ? "Şablon" : "Planlı"}
                  </td>
                  <td className="text-right">{t.amount === null ? "tutar bekleniyor" : money(t.amount)}</td>
                  <td className={`text-right font-medium ${t.paid ? "text-income" : "text-expense"}`}>
                    {t.paid ? "✓ Ödendi" : "Ödenmedi"}
                  </td>
                </tr>
              ))}
            </Table>
          </ReportSection>
        )}

        {/* Gelecek ay */}
        {expected && expected.items.length > 0 && (
          <ReportSection title={`${monthLabel(nextMonth)} · beklenen ödemeler`}>
            <Table head={["Tarih", "Ödeme", "Tutar"]} align={["l", "l", "r"]}>
              {expected.items.map((i, k) => (
                <tr key={`${i.date}-${k}`}>
                  <td className="whitespace-nowrap">{dayMonthShort(i.date)}</td>
                  <td>
                    {i.note || catName(i.categoryId)}
                    {i.fixed && <span className="ml-1 text-ink-3">· sabit</span>}
                  </td>
                  <td className="text-right">{i.amount === null ? "tutar bekleniyor" : money(i.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td />
                <td>Toplam</td>
                <td className="text-right">{money(expected.total)}</td>
              </tr>
            </Table>
          </ReportSection>
        )}

        {/* Madde madde (isteğe bağlı; seçilmezse gizli, bkz. report-options.tsx) */}
        <ItemList
          className="report-items-expense"
          title="Giderler · madde madde"
          list={expenseItems}
          kind="expense"
          catName={catName}
          catEmoji={(id) => (id ? catBy.get(id)?.emoji : "none")}
          money={money}
        />
        <ItemList
          className="report-items-income"
          title="Gelirler · madde madde"
          list={incomeItems}
          kind="income"
          catName={catName}
          catEmoji={(id) => (id ? catBy.get(id)?.emoji : "none")}
          money={money}
        />

        <footer className="mt-10 border-t border-line pt-4 text-center text-[10px] text-ink-3">
          Gri Hesap Defteri ile hazırlandı · {ownerName}
        </footer>
      </article>
    </main>
  );
}

/** Raporun başındaki kısa yorumlar. */
function buildInsights(
  a: MonthAnalysis,
  money: (minor: number, sign?: boolean) => string,
  catName: (id: string | null) => string,
  prevMonth: string,
): string[] {
  const out: string[] = [];
  const s = a.summary;
  if (s.expense > 0 && a.expense.prev > 0 && a.expense.pct !== null) {
    out.push(
      `Giderlerin ${monthLabel(prevMonth)} ayına göre ${pct.format(Math.abs(a.expense.pct))} ${a.expense.diff >= 0 ? "arttı" : "azaldı"} (${money(a.expense.diff, true)}).`,
    );
  }
  const topCat = a.categories[0];
  if (topCat && topCat.total > 0) {
    out.push(
      `En çok harcama ${catName(topCat.categoryId)} kategorisinde: ${money(topCat.total)} (toplam giderdeki payı ${pct.format(topCat.share)}).`,
    );
  }
  const rising = a.categories
    .filter((c) => c.prev > 0 && c.total > c.prev)
    .sort((x, y) => y.total - y.prev - (x.total - x.prev))[0];
  if (rising)
    out.push(`En çok artan kategori ${catName(rising.categoryId)}: ${money(rising.total - rising.prev, true)}.`);
  if (a.daily.maxDay)
    out.push(`En yüksek harcama ${dayMonth(a.daily.maxDay.date)} günü yapıldı: ${money(a.daily.maxDay.amount)}.`);
  if (a.daily.dayCount > 0) out.push(`${a.daily.dayCount} günün ${a.daily.noSpendDays} gününde hiç harcama yapılmadı.`);
  if (s.expense > 0)
    out.push(`Sabit ödemelerin (düzenli, taksit, şablon) toplam giderdeki payı ${pct.format(a.fixed / s.expense)}.`);
  if (a.average.expense !== null && a.average.months > 0 && s.expense > 0) {
    const d = s.expense / a.average.expense - 1;
    if (Number.isFinite(d)) {
      out.push(
        `Bu ayki gider, önceki ${a.average.months} ayın ortalamasının ${pct.format(Math.abs(d))} ${d >= 0 ? "üstünde" : "altında"}.`,
      );
    }
  }
  if (a.budget?.over) out.push(`${a.budget.over} kategoride bütçe aşıldı.`);
  if (s.income > 0)
    out.push(`Tasarruf oranı ${pct.format(s.net / s.income)}${s.net < 0 ? " (gider gelirden fazla)" : ""}.`);
  return out;
}

/** Günlük gider çubukları (yazdırmada da görünen saf SVG). */
function DailyChart({ days, max }: { days: { date: string; expense: number }[]; max: number }) {
  const W = 700;
  const H = 120;
  const gap = 2;
  const bw = W / Math.max(days.length, 1) - gap;
  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" role="img" aria-label="Günlük harcama grafiği">
      <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line)" />
      {days.map((d, i) => {
        const h = max > 0 ? Math.max((d.expense / max) * (H - 6), d.expense > 0 ? 2 : 0) : 0;
        const x = i * (bw + gap);
        const day = Number(d.date.slice(8, 10));
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={H - h}
              width={bw}
              height={h}
              rx={1.5}
              fill={d.expense === max && max > 0 ? "var(--expense)" : "var(--ink-3)"}
              opacity={0.85}
            />
            {(day === 1 || day % 5 === 0) && (
              <text x={x + bw / 2} y={H + 12} textAnchor="middle" fontSize={9} fill="var(--ink-3)">
                {day}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
