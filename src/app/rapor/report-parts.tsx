import { Fragment } from "react";
import { AppIcon } from "@/components/category-icon";
import { dayMonthShort } from "@/lib/dates";
import { isFixed, type Change, type itemize } from "@/lib/report";

// Aylık ve yıllık raporun ortak parçaları.

export const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });
const pctSigned = new Intl.NumberFormat("tr-TR", {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
export const fullDate = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function Kpi({
  label,
  value,
  tone,
  delta,
  money,
  invert = false,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense";
  delta?: Change;
  money?: (minor: number, sign?: boolean) => string;
  /** Gider gibi: artış kötü */
  invert?: boolean;
}) {
  const good = delta ? (invert ? delta.diff <= 0 : delta.diff >= 0) : true;
  return (
    <div className="rounded-2xl border border-line px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p
        className={`num mt-1 text-lg font-semibold ${tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : ""}`}
      >
        {value}
      </p>
      {delta && money && delta.prev !== 0 && (
        <p
          className={`num mt-0.5 text-[10px] ${delta.diff === 0 ? "text-ink-3" : good ? "text-income" : "text-expense"}`}
        >
          {money(delta.diff, true)}
          {delta.pct !== null && ` (${pctSigned.format(delta.pct).replace("-", "−")})`}
        </p>
      )}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "income" | "expense";
}) {
  return (
    <div className="rounded-xl bg-surface-2/60 px-3 py-2.5">
      <p className="text-[10px] text-ink-3">{label}</p>
      <p
        className={`num mt-0.5 text-sm font-semibold ${tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : ""}`}
      >
        {value}
      </p>
      {hint && <p className="text-[10px] text-ink-3">{hint}</p>}
    </div>
  );
}

export function SplitBar({
  parts,
  total,
  money,
}: {
  parts: { label: string; value: number; tone: string }[];
  total: number;
  money: (minor: number) => string;
}) {
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
        {parts.map((p) => (
          <span key={p.label} className={p.tone} style={{ width: `${total ? (p.value / total) * 100 : 0}%` }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-xs">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={`size-2 shrink-0 rounded-full ${p.tone}`} />
            <span className="flex-1 text-ink-2">{p.label}</span>
            <span className="num font-medium">{money(p.value)}</span>
            <span className="num w-9 text-right text-ink-3">{pct.format(total ? p.value / total : 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="avoid-break-after mb-3 font-serif text-2xl tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function Table({ head, align, children }: { head: string[]; align: ("l" | "r")[]; children: React.ReactNode }) {
  return (
    <div className="-mx-2 overflow-x-auto px-2 print:mx-0 print:overflow-visible print:px-0">
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
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-3">{children}</p>;
}

/** Kategoriye göre gruplu, ara toplamlı madde madde liste. */
export function ItemList({
  className,
  title,
  list,
  kind,
  catName,
  catEmoji,
  money,
  period = "Bu ay",
}: {
  className: string;
  title: string;
  list: ReturnType<typeof itemize>;
  kind: "income" | "expense";
  catName: (id: string | null) => string;
  catEmoji: (id: string | null) => string | undefined;
  money: (minor: number, sign?: boolean) => string;
  /** Boşken: "Bu ay" / "Bu yıl" */
  period?: string;
}) {
  return (
    <div className={className}>
      <ReportSection title={`${title} (${list.count})`}>
        {list.count === 0 ? (
          <Empty>
            {period} {kind === "income" ? "gelir" : "gider"} kaydı yok.
          </Empty>
        ) : (
          <Table head={["Tarih", "Açıklama", "Not", "Tutar"]} align={["l", "l", "l", "r"]}>
            {list.groups.map((g) => (
              <Fragment key={g.categoryId ?? "-"}>
                <tr className="bg-surface-2/60 font-semibold">
                  <td colSpan={3}>
                    <AppIcon
                      name={catEmoji(g.categoryId)}
                      size={13}
                      className="mr-1.5 inline-block align-[-2px] text-ink-2"
                    />
                    {catName(g.categoryId)}
                    <span className="ml-1 font-normal text-ink-3">· {g.items.length} kalem</span>
                  </td>
                  <td className="whitespace-nowrap text-right">{money(g.total)}</td>
                </tr>
                {g.items.map((t, i) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap pl-6 text-ink-2">
                      <span className="mr-1 text-ink-3">{i + 1}.</span>
                      {dayMonthShort(t.occurred_on)}
                    </td>
                    <td>{t.note || catName(t.category_id)}</td>
                    <td className="text-ink-3">
                      {[
                        kind === "expense" && t.loan_id ? "taksit" : null,
                        kind === "expense" && t.recurring_id ? "düzenli" : null,
                        kind === "expense" && t.template_id ? "şablon" : null,
                        t.fx_code && t.fx_amount !== null ? `${t.fx_amount} ${t.fx_code}` : null,
                        kind === "expense" && !t.paid && t.amount !== null && isFixed(t) ? "ödenmedi" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className={`whitespace-nowrap text-right ${kind === "income" ? "text-income" : ""}`}>
                      {t.amount === null ? "tutar bekleniyor" : money(t.amount)}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="font-semibold">
              <td colSpan={3}>{kind === "income" ? "Toplam gelir" : "Toplam gider"}</td>
              <td className={`whitespace-nowrap text-right ${kind === "income" ? "text-income" : "text-expense"}`}>
                {money(list.total)}
              </td>
            </tr>
          </Table>
        )}
      </ReportSection>
    </div>
  );
}
