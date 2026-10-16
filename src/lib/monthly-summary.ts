import { formatMoney } from "@/lib/money";

const monthName = (month: string) =>
  new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

/** Ay sonu özeti bildirimi: "Eylül özeti: ₺4.500 biriktirdin" + gelir/gider ve en çok harcanan kategori. */
export function monthlySummary(input: {
  month: string;
  income: number;
  expense: number;
  top: { name: string; total: number } | null;
  currency: string;
}): { title: string; body: string } {
  const { month, income, expense, top, currency } = input;
  const net = income - expense;
  const name = monthName(month);
  const head = name.charAt(0).toLocaleUpperCase("tr") + name.slice(1);
  const title =
    net > 0
      ? `${head} özeti: ${formatMoney(net, currency)} biriktirdin`
      : net < 0
        ? `${head} özeti: giderler gelirini ${formatMoney(-net, currency)} aştı`
        : `${head} özeti: gelir ve gider başa baş`;
  const parts = [`Gelir ${formatMoney(income, currency)}`, `gider ${formatMoney(expense, currency)}`];
  if (income > 0 && net > 0) parts.push(`tasarruf %${Math.round((net / income) * 100)}`);
  let body = parts.join(" · ") + ".";
  if (top && expense > 0) body += ` En çok ${top.name} (${formatMoney(top.total, currency)}).`;
  return { title, body };
}

/** Önceki ay ("2026-10-01" → "2026-09"). */
export function previousMonth(today: string): string {
  const [y, m] = today.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
