import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { AppIcon } from "@/components/category-icon";
import type { YearSummary } from "@/lib/data";
import { dayMonthShort, monthName, monthShort } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { NetWorthPoint } from "@/lib/net-worth";
import { analyzeYear, itemize, WEEKDAYS, type YearAnalysis } from "@/lib/report";
import type { CategoryRow, TransactionRow } from "@/lib/types";
import { PrintButton } from "../print-button";
import { ReportOptions } from "../report-options";
import { Empty, fullDate, ItemList, Kpi, pct, ReportSection, SplitBar, Stat, Table } from "../report-parts";

type Money = (minor: number, sign?: boolean) => string;

/** Yıllık rapor (PDF olarak kaydedilebilir); veri page.tsx'te çekilir. */
export function YearReportView({
  ownerName,
  shared,
  today,
  year,
  thisYear,
  firstYear,
  currency,
  autoPrint,
  transactions,
  previous,
  categories,
  netHistory,
}: {
  ownerName: string;
  shared: boolean;
  today: string;
  year: number;
  thisYear: number;
  firstYear: number;
  currency: string;
  autoPrint: boolean;
  transactions: TransactionRow[];
  previous: YearSummary;
  categories: CategoryRow[];
  netHistory: NetWorthPoint[];
}) {
  const money: Money = (minor, sign = false) => formatMoney(minor, currency, { sign });
  const catBy = new Map(categories.map((c) => [c.id, c]));
  const catName = (id: string | null) => (id ? (catBy.get(id)?.name ?? "Kategorisiz") : "Kategorisiz");
  const catEmoji = (id: string | null) => (id ? catBy.get(id)?.emoji : "none");
  const a = analyzeYear({ year, today, transactions, previous });
  const income = a.income.cur;
  const expense = a.expense.cur;
  const net = a.net.cur;
  const savings = income > 0 ? net / income : null;
  const expenseItems = itemize(transactions, "expense");
  const incomeItems = itemize(transactions, "income");
  const points = netHistory.filter((p) => p.day.startsWith(`${year}-`));
  const netStart = points[0];
  const netEnd = points.at(-1);
  const title = `${year} yıllık raporu`;
  const insights = buildInsights(a, money, catName, year);
  const ongoing = year === thisYear;
  const prevYearExpense = a.prevMonths.reduce((s, m) => s + m.expense, 0);

  return (
    <main className="report min-h-dvh bg-bg pb-16 print:bg-white print:pb-0">
      {/* Araç çubuğu (yazdırılmaz) */}
      <div className="no-print pt-safe sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] items-center gap-2 py-3 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
          <Link
            href={`/yillik?yil=${year}`}
            className="-ml-2 flex h-10 items-center gap-1 rounded-full px-2 text-sm text-ink-2 hover:text-ink"
          >
            <ArrowLeft size={16} /> Özet
          </Link>
          <div className="mx-auto flex items-center gap-1">
            <YearNav year={year - 1} disabled={year - 1 < firstYear} dir="prev" />
            <span className="num min-w-16 text-center text-sm font-medium">{year}</span>
            <YearNav year={year + 1} disabled={year + 1 > thisYear} dir="next" />
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
            <h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-1 text-xs text-ink-3">
              {a.count.toLocaleString("tr-TR")} kayıt
              {ongoing && ` · yıl devam ediyor (${a.elapsed} ay)`}
            </p>
          </div>
          <p className="text-right text-xs text-ink-3">
            Hazırlanma
            <br />
            {fullDate.format(new Date(`${today}T00:00:00Z`))}
          </p>
        </header>

        {/* Toplamlar + geçen yıla göre */}
        <section className="avoid-break mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Gelir" value={money(income)} tone="income" delta={a.income} money={money} />
          <Kpi label="Gider" value={money(expense)} tone="expense" delta={a.expense} money={money} invert />
          <Kpi
            label="Net"
            value={money(net, true)}
            tone={net < 0 ? "expense" : undefined}
            delta={a.net}
            money={money}
          />
          <Kpi label="Tasarruf oranı" value={savings === null ? "—" : pct.format(savings)} />
        </section>
        <p className="mt-2 text-[10px] text-ink-3">
          {a.hasPrevious &&
            (a.samePeriod
              ? `Kutulardaki küçük yazılar ${year - 1} yılının aynı dönemine (Ocak–${monthName(a.months[a.elapsed - 1]!.month)}) göre değişimdir.`
              : `Kutulardaki küçük yazılar ${year - 1} yılına göre değişimdir.`)}
          {a.pendingAmounts > 0 && ` ${a.pendingAmounts} kaydın tutarı henüz girilmediği için toplamlara dahil değil.`}
        </p>

        {insights.length > 0 && (
          <ReportSection title="Yılın öne çıkanları">
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

        {/* Aylara göre */}
        <ReportSection title="Aylara göre">
          <div className="avoid-break">
            <MonthChart months={a.months} />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Aylık ortalama gelir" value={money(a.average.income)} hint={`${a.elapsed} ay üzerinden`} />
              <Stat label="Aylık ortalama gider" value={money(a.average.expense)} hint={`${a.elapsed} ay üzerinden`} />
              <Stat
                label="En iyi ay"
                value={a.best ? money(a.best.income - a.best.expense, true) : "—"}
                hint={a.best ? monthName(a.best.month) : undefined}
                tone={a.best && a.best.income >= a.best.expense ? "income" : undefined}
              />
              <Stat
                label="En yüksek harcama"
                value={a.heaviest ? money(a.heaviest.expense) : "—"}
                hint={a.heaviest ? monthName(a.heaviest.month) : undefined}
              />
            </div>
          </div>
          <div className="mt-4">
            <Table
              head={["Ay", "Gelir", "Gider", "Net", "Tasarruf", `Gider ${year - 1}`]}
              align={["l", "r", "r", "r", "r", "r"]}
            >
              {a.months.map((m, i) => {
                const prev = a.prevMonths[i]?.expense ?? 0;
                const empty = m.income === 0 && m.expense === 0;
                return (
                  <tr key={m.month} className={empty ? "text-ink-3" : undefined}>
                    <td className="capitalize">{monthName(m.month)}</td>
                    <td className="text-right">{m.income ? money(m.income) : "—"}</td>
                    <td className="text-right">{m.expense ? money(m.expense) : "—"}</td>
                    <td className={`text-right ${m.income - m.expense < 0 ? "text-expense" : ""}`}>
                      {empty ? "—" : money(m.income - m.expense, true)}
                    </td>
                    <td className="text-right text-ink-3">
                      {m.income > 0 ? pct.format((m.income - m.expense) / m.income) : "—"}
                    </td>
                    <td className="text-right text-ink-3">{prev ? money(prev) : "—"}</td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td>Toplam</td>
                <td className="text-right text-income">{money(income)}</td>
                <td className="text-right">{money(expense)}</td>
                <td className={`text-right ${net < 0 ? "text-expense" : ""}`}>{money(net, true)}</td>
                <td className="text-right">{savings === null ? "—" : pct.format(savings)}</td>
                <td className="text-right text-ink-3">{prevYearExpense ? money(prevYearExpense) : "—"}</td>
              </tr>
            </Table>
          </div>
        </ReportSection>

        {/* Kategoriler */}
        <ReportSection title="Kategorilere göre giderler">
          {a.expenseCategories.length === 0 ? (
            <Empty>Bu yıl gider yok.</Empty>
          ) : (
            <Table
              head={[
                "Kategori",
                "Pay",
                "Tutar",
                "Aylık ort.",
                a.samePeriod ? `${year - 1} (tüm yıl)` : String(year - 1),
                ...(a.samePeriod ? [] : ["Değişim"]),
              ]}
              align={["l", "l", "r", "r", "r", "r"]}
            >
              {a.expenseCategories.map((c) => (
                <tr key={c.key}>
                  <td>
                    <AppIcon
                      name={catEmoji(c.categoryId)}
                      size={13}
                      className="mr-1.5 inline-block align-[-2px] text-ink-2"
                    />
                    {catName(c.categoryId)}
                    <span className="ml-1 text-ink-3">({c.count})</span>
                  </td>
                  <td className="w-[20%]">
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
                  <td className="text-right text-ink-3">
                    {c.total && a.elapsed ? money(Math.round(c.total / a.elapsed)) : "—"}
                  </td>
                  <td className="text-right text-ink-3">{c.prev ? money(c.prev) : "—"}</td>
                  {!a.samePeriod && (
                    <td
                      className={`text-right ${c.total > c.prev ? "text-expense" : c.total < c.prev ? "text-income" : "text-ink-3"}`}
                    >
                      {c.prev === 0 && c.total > 0 ? "yeni" : c.total === c.prev ? "—" : money(c.total - c.prev, true)}
                    </td>
                  )}
                </tr>
              ))}
            </Table>
          )}
        </ReportSection>

        {/* Sabit / değişken + haftanın günleri */}
        {expense > 0 && (
          <section className="avoid-break mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="mb-3 font-serif text-2xl tracking-tight">Sabit ve değişken</h2>
              <SplitBar
                parts={[
                  { label: "Sabit (düzenli, taksit, şablon)", value: a.fixed, tone: "bg-ink-2" },
                  { label: "Değişken (günlük harcamalar)", value: a.variable, tone: "bg-expense" },
                ]}
                total={expense}
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
          <ReportSection title="Yılın en büyük giderleri">
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

        {/* Gelirler */}
        {a.incomeCategories.some((c) => c.total > 0) && (
          <ReportSection title="Gelirler">
            <Table
              head={["Kategori", "İşlem", "Tutar", "Pay", a.samePeriod ? `${year - 1} (tüm yıl)` : String(year - 1)]}
              align={["l", "r", "r", "r", "r"]}
            >
              {a.incomeCategories.map((c) => (
                <tr key={c.key}>
                  <td>{catName(c.categoryId)}</td>
                  <td className="text-right">{c.count || "—"}</td>
                  <td className="text-right font-medium">{c.total ? money(c.total) : "—"}</td>
                  <td className="text-right text-ink-3">{c.total ? pct.format(c.share) : "—"}</td>
                  <td className="text-right text-ink-3">{c.prev ? money(c.prev) : "—"}</td>
                </tr>
              ))}
            </Table>
          </ReportSection>
        )}

        {/* Net varlık */}
        {netStart && netEnd && netStart.day !== netEnd.day && (
          <ReportSection title="Net varlık">
            <div className="avoid-break grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label={`İlk kayıt (${dayMonthShort(netStart.day)})`}
                value={money(netStart.assets - netStart.debts)}
              />
              <Stat label={`Son kayıt (${dayMonthShort(netEnd.day)})`} value={money(netEnd.assets - netEnd.debts)} />
              <Stat
                label="Değişim"
                value={money(netEnd.assets - netEnd.debts - (netStart.assets - netStart.debts), true)}
                tone={netEnd.assets - netEnd.debts >= netStart.assets - netStart.debts ? "income" : "expense"}
              />
              <Stat label="Borçlar (son kayıt)" value={money(netEnd.debts)} />
            </div>
            <p className="mt-2 text-[10px] text-ink-3">
              Varlıklar sayfasının açıldığı günlerde kaydedilen değerlerden (en fazla son bir yıl).
            </p>
          </ReportSection>
        )}

        {/* Madde madde (isteğe bağlı; seçilmezse gizli, bkz. report-options.tsx) */}
        <ItemList
          className="report-items-expense"
          title="Giderler · madde madde"
          list={expenseItems}
          kind="expense"
          catName={catName}
          catEmoji={catEmoji}
          money={money}
          period="Bu yıl"
        />
        <ItemList
          className="report-items-income"
          title="Gelirler · madde madde"
          list={incomeItems}
          kind="income"
          catName={catName}
          catEmoji={catEmoji}
          money={money}
          period="Bu yıl"
        />

        <footer className="mt-10 border-t border-line pt-4 text-center text-[10px] text-ink-3">
          Gri Hesap Defteri ile hazırlandı · {ownerName}
        </footer>
      </article>
    </main>
  );
}

function YearNav({ year, disabled, dir }: { year: number; disabled: boolean; dir: "prev" | "next" }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  const cls = "grid size-9 place-items-center rounded-full";
  return disabled ? (
    <span className={`${cls} text-ink-3 opacity-40`} aria-hidden>
      <Icon size={17} />
    </span>
  ) : (
    <Link
      href={`/rapor/yil?yil=${year}`}
      className={`${cls} hover:bg-surface-2`}
      aria-label={dir === "prev" ? "Önceki yıl" : "Sonraki yıl"}
    >
      <Icon size={17} />
    </Link>
  );
}

/** 12 ay gelir/gider çubukları (yazdırmada da görünen saf SVG). */
function MonthChart({ months }: { months: YearAnalysis["months"] }) {
  const W = 700;
  const H = 130;
  const slot = W / 12;
  const bw = Math.min(16, slot / 2 - 4);
  const max = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));
  const h = (v: number) => (v > 0 ? Math.max((v / max) * (H - 6), 2) : 0);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" role="img" aria-label="Aylık gelir ve gider grafiği">
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line)" />
        {months.map((m, i) => {
          const cx = i * slot + slot / 2;
          return (
            <g key={m.month}>
              <rect x={cx - bw - 1} y={H - h(m.income)} width={bw} height={h(m.income)} rx={2} fill="var(--income)" />
              <rect x={cx + 1} y={H - h(m.expense)} width={bw} height={h(m.expense)} rx={2} fill="var(--expense)" />
              <text x={cx} y={H + 12} textAnchor="middle" fontSize={9} fill="var(--ink-3)" className="capitalize">
                {monthShort(m.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-[10px] text-ink-3">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-income" /> gelir
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-expense" /> gider
        </span>
      </figcaption>
    </figure>
  );
}

/** Raporun başındaki kısa yorumlar. */
function buildInsights(a: YearAnalysis, money: Money, catName: (id: string | null) => string, year: number) {
  const out: string[] = [];
  const prevYear = year - 1;
  if (a.hasPrevious && a.expense.pct !== null && a.expense.cur > 0) {
    out.push(
      `Giderlerin ${a.samePeriod ? `${prevYear} yılının aynı dönemine` : `${prevYear} yılına`} göre ${pct.format(Math.abs(a.expense.pct))} ${a.expense.diff >= 0 ? "arttı" : "azaldı"} (${money(a.expense.diff, true)}).`,
    );
  }
  if (a.hasPrevious && a.income.pct !== null && a.income.cur > 0) {
    out.push(
      `Gelirin ${a.samePeriod ? `${prevYear} yılının aynı dönemine` : `${prevYear} yılına`} göre ${pct.format(Math.abs(a.income.pct))} ${a.income.diff >= 0 ? "arttı" : "azaldı"} (${money(a.income.diff, true)}).`,
    );
  }
  const topCat = a.expenseCategories[0];
  if (topCat && topCat.total > 0) {
    out.push(
      `En çok harcama ${catName(topCat.categoryId)} kategorisinde: ${money(topCat.total)} (toplam giderdeki payı ${pct.format(topCat.share)}).`,
    );
  }
  const rising =
    !a.samePeriod &&
    a.expenseCategories
      .filter((c) => c.prev > 0 && c.total > c.prev)
      .sort((x, y) => y.total - y.prev - (x.total - x.prev))[0];
  if (rising)
    out.push(`En çok artan kategori ${catName(rising.categoryId)}: ${money(rising.total - rising.prev, true)}.`);
  if (a.best) out.push(`En iyi ay ${monthName(a.best.month)}: ${money(a.best.income - a.best.expense, true)} net.`);
  if (a.heaviest)
    out.push(`En çok harcama ${monthName(a.heaviest.month)} ayında yapıldı: ${money(a.heaviest.expense)}.`);
  if (a.lightest) out.push(`En az harcama ${monthName(a.lightest.month)} ayında: ${money(a.lightest.expense)}.`);
  if (a.expense.cur > 0)
    out.push(
      `Sabit ödemelerin (düzenli, taksit, şablon) toplam giderdeki payı ${pct.format(a.fixed / a.expense.cur)}.`,
    );
  if (a.income.cur > 0) {
    const net = a.net.cur;
    out.push(
      net >= 0
        ? `Yıl boyunca gelirin ${pct.format(net / a.income.cur)} kadarı biriktirildi (${money(net)}).`
        : `Yıl boyunca gider gelirden ${money(-net)} fazla oldu.`,
    );
  }
  return out;
}
