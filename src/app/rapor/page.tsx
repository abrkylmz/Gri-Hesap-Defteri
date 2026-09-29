import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getCategories, getMonthTransactions, getProfile, getTrend } from "@/lib/data";
import { addMonths, dayMonthShort, isMonthKey, monthLabel, monthOf, monthShort, todayIn } from "@/lib/dates";
import { isBill, summarize } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { getScope } from "@/lib/scope";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aylık rapor", robots: { index: false } };

const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });
const fullDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ay, yazdir } = await searchParams;
  const [scope, profile] = await Promise.all([getScope(), getProfile()]);
  const today = todayIn(profile.timezone);
  const month = isMonthKey(ay) ? ay : monthOf(today);
  const [transactions, categories, trend] = await Promise.all([
    getMonthTransactions(month),
    getCategories(),
    getTrend(month),
  ]);

  const cur = profile.currency;
  const money = (minor: number, sign = false) => formatMoney(minor, cur, { sign });
  const catBy = new Map(categories.map((c) => [c.id, c]));
  const catName = (id: string | null) => (id ? (catBy.get(id)?.name ?? "Kategorisiz") : "Kategorisiz");
  const s = summarize(transactions, month);
  const savings = s.income > 0 ? s.net / s.income : null;
  const bills = transactions
    .filter((t) => isBill(t, today))
    .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  const all = [...transactions].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  const title = `${monthLabel(month)} raporu`;

  return (
    <main className="report min-h-dvh bg-bg pb-16 print:bg-white print:pb-0">
      {/* Araç çubuğu (yazdırılmaz) */}
      <div className="no-print sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] items-center gap-2 px-5 py-3">
          <Link href={`/?ay=${month}`} className="flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
            <ArrowLeft size={16} /> Defter
          </Link>
          <div className="mx-auto flex items-center gap-1">
            <Link href={`/rapor?ay=${addMonths(month, -1)}`} className="grid size-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Önceki ay">
              <ChevronLeft size={17} />
            </Link>
            <span className="min-w-28 text-center text-sm font-medium capitalize">{monthLabel(month)}</span>
            <Link href={`/rapor?ay=${addMonths(month, 1)}`} className="grid size-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Sonraki ay">
              <ChevronRight size={17} />
            </Link>
          </div>
          <PrintButton auto={yazdir === "1"} fileTitle={`Gri - ${title}`} />
        </div>
      </div>

      <article className="mx-auto mt-6 max-w-[210mm] rounded-3xl border border-line bg-surface p-8 text-ink sm:p-12 print:mt-0 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="eyebrow">Gri Hesap Defteri{scope.shared ? ` · ${scope.ownerName} adlı kişinin defteri` : ""}</p>
            <h1 className="mt-2 font-serif text-4xl capitalize tracking-tight sm:text-5xl">{title}</h1>
          </div>
          <p className="text-right text-xs text-ink-3">
            Hazırlanma
            <br />
            {fullDate.format(new Date(`${today}T00:00:00Z`))}
          </p>
        </header>

        {/* Özet */}
        <section className="avoid-break mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Gelir" value={money(s.income)} tone="income" />
          <Kpi label="Gider" value={money(s.expense)} tone="expense" />
          <Kpi label="Net" value={money(s.net, true)} tone={s.net < 0 ? "expense" : undefined} />
          <Kpi label="Tasarruf oranı" value={savings === null ? "—" : pct.format(savings)} />
        </section>
        {s.pendingAmounts > 0 && (
          <p className="mt-3 text-xs text-ink-3">
            Not: {s.pendingAmounts} kaydın tutarı henüz girilmediği için toplamlara dahil değil.
          </p>
        )}

        {/* Kategoriler */}
        <ReportSection title="Kategorilere göre giderler">
          {s.categories.expense.length === 0 ? (
            <Empty>Bu ay gider yok.</Empty>
          ) : (
            <Table head={["Kategori", "İşlem", "Tutar", "Pay", "Bütçe durumu"]} align={["l", "r", "r", "r", "r"]}>
              {s.categories.expense.map((c) => {
                const budget = c.categoryId ? catBy.get(c.categoryId)?.monthly_budget : null;
                return (
                  <tr key={c.key}>
                    <td>
                      {c.categoryId ? catBy.get(c.categoryId)?.emoji : "·"} {catName(c.categoryId)}
                    </td>
                    <td className="text-right">{c.count}</td>
                    <td className="text-right font-medium">{money(c.total)}</td>
                    <td className="text-right text-ink-3">{pct.format(c.total / (s.expense || 1))}</td>
                    <td className={`text-right ${budget && c.total > budget ? "text-expense" : "text-ink-3"}`}>
                      {budget ? (c.total > budget ? `${money(c.total - budget)} aşıldı` : `${money(budget - c.total)} kaldı`) : "—"}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </ReportSection>

        {s.categories.income.length > 0 && (
          <ReportSection title="Gelirler">
            <Table head={["Kategori", "İşlem", "Tutar"]} align={["l", "r", "r"]}>
              {s.categories.income.map((c) => (
                <tr key={c.key}>
                  <td>{catName(c.categoryId)}</td>
                  <td className="text-right">{c.count}</td>
                  <td className="text-right font-medium">{money(c.total)}</td>
                </tr>
              ))}
            </Table>
          </ReportSection>
        )}

        {/* Son 6 ay */}
        <ReportSection title="Son altı ay">
          <Table head={["Ay", "Gelir", "Gider", "Net"]} align={["l", "r", "r", "r"]}>
            {trend.map((t) => (
              <tr key={t.month} className={t.month === month ? "font-semibold" : undefined}>
                <td className="capitalize">{monthShort(t.month)} {t.month.slice(0, 4)}</td>
                <td className="text-right">{money(t.income)}</td>
                <td className="text-right">{money(t.expense)}</td>
                <td className={`text-right ${t.income - t.expense < 0 ? "text-expense" : ""}`}>{money(t.income - t.expense, true)}</td>
              </tr>
            ))}
          </Table>
        </ReportSection>

        {/* Ödemeler */}
        {bills.length > 0 && (
          <ReportSection title="Ödemeler">
            <Table head={["Tarih", "Ödeme", "Tutar", "Durum"]} align={["l", "l", "r", "r"]}>
              {bills.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{dayMonthShort(t.occurred_on)}</td>
                  <td>{t.note || catName(t.category_id)}</td>
                  <td className="text-right">{t.amount === null ? "tutar bekleniyor" : money(t.amount)}</td>
                  <td className={`text-right font-medium ${t.paid ? "text-income" : "text-expense"}`}>
                    {t.paid ? "✓ Ödendi" : "Ödenmedi"}
                  </td>
                </tr>
              ))}
            </Table>
          </ReportSection>
        )}

        {/* Tüm hareketler */}
        <ReportSection title={`Tüm hareketler (${all.length})`}>
          {all.length === 0 ? (
            <Empty>Bu ay kayıt yok.</Empty>
          ) : (
            <Table head={["Tarih", "Açıklama", "Kategori", "Tutar"]} align={["l", "l", "l", "r"]}>
              {all.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{dayMonthShort(t.occurred_on)}</td>
                  <td>{t.note || "—"}</td>
                  <td className="text-ink-2">{catName(t.category_id)}</td>
                  <td className={`whitespace-nowrap text-right ${t.kind === "income" ? "text-income" : ""}`}>
                    {t.amount === null ? "—" : money(t.kind === "income" ? t.amount : -t.amount, true)}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </ReportSection>

        <footer className="mt-10 border-t border-line pt-4 text-center text-[10px] text-ink-3">
          Gri Hesap Defteri ile hazırlandı · {scope.ownerName}
        </footer>
      </article>
    </main>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "income" | "expense" }) {
  return (
    <div className="rounded-2xl border border-line px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={`num mt-1 text-lg font-semibold ${tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="avoid-break-after mb-3 font-serif text-2xl tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, align, children }: { head: string[]; align: ("l" | "r")[]; children: React.ReactNode }) {
  return (
    <table className="report-table num w-full text-xs">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} className={align[i] === "r" ? "text-right" : "text-left"}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-3">{children}</p>;
}
