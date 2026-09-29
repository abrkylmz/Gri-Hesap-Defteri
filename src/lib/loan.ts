// Kredi hesaplama (eşit taksitli / annüite). Tüm tutarlar kuruş; oranlar yüzde.
// UI'dan bağımsız ve birim testli (loan.test.ts).

import { addMonths, dateInMonth, dayOf, monthOf } from "@/lib/dates";

export type LoanType = "ihtiyac" | "tasit" | "konut" | "ticari";

/**
 * Kredi türüne göre faize eklenen vergiler (%). Varsayılanlardır: mevzuat değişebilir,
 * kullanıcı hesaplayıcıda düzeltebilir.
 */
export const LOAN_TYPES: Record<LoanType, { label: string; kkdf: number; bsmv: number }> = {
  ihtiyac: { label: "İhtiyaç", kkdf: 15, bsmv: 15 },
  tasit: { label: "Taşıt", kkdf: 15, bsmv: 15 },
  konut: { label: "Konut", kkdf: 0, bsmv: 0 },
  ticari: { label: "Ticari", kkdf: 0, bsmv: 5 },
};

export type ScheduleRow = {
  no: number;
  /** Taksit tutarı */
  payment: number;
  principal: number;
  interest: number;
  /** KKDF + BSMV */
  tax: number;
  /** Bu taksitten sonra kalan anapara */
  remaining: number;
};

export type Schedule = {
  rows: ScheduleRow[];
  /** İlk (ve son hariç tüm) taksitlerin tutarı */
  installment: number;
  totalPayment: number;
  totalInterest: number;
  totalTax: number;
  /** Faiz + vergi: kredinin toplam maliyeti */
  totalCost: number;
};

/**
 * Eşit taksitli ödeme planı.
 * @param principal kredi tutarı (kuruş)
 * @param monthlyRatePct aylık akdi faiz (ör. 3.49)
 * @param kkdfPct / bsmvPct faiz üzerinden alınan vergiler (ör. 15)
 * @param months vade (ay)
 */
export function annuitySchedule(
  principal: number,
  monthlyRatePct: number,
  kkdfPct: number,
  bsmvPct: number,
  months: number,
): Schedule {
  const r = monthlyRatePct / 100;
  const taxRate = (kkdfPct + bsmvPct) / 100;
  const rEff = r * (1 + taxRate);
  const raw = rEff === 0 ? principal / months : (principal * rEff) / (1 - Math.pow(1 + rEff, -months));
  const installment = Math.round(raw);

  const rows: ScheduleRow[] = [];
  let remaining = principal;
  for (let no = 1; no <= months; no++) {
    const interest = Math.round(remaining * r);
    const tax = Math.round(interest * taxRate);
    const last = no === months;
    // Son taksit, yuvarlama farklarını kapatır: kalan anapara tam sıfırlanır.
    const principalPart = last ? remaining : Math.min(remaining, installment - interest - tax);
    const payment = principalPart + interest + tax;
    remaining -= principalPart;
    rows.push({ no, payment, principal: principalPart, interest, tax, remaining });
  }
  return summarizeSchedule(rows, installment);
}

/** Taksit tutarı bankadan biliniyorsa: her ay aynı taksit; faiz/vergi ayrımı bilinmez. */
export function fixedSchedule(installment: number, months: number, principal: number | null): Schedule {
  const rows: ScheduleRow[] = Array.from({ length: months }, (_, i) => ({
    no: i + 1,
    payment: installment,
    principal: 0,
    interest: 0,
    tax: 0,
    remaining: 0,
  }));
  const s = summarizeSchedule(rows, installment);
  // Anapara biliniyorsa toplam maliyet = toplam ödeme − anapara.
  const cost = principal ? s.totalPayment - principal : 0;
  return { ...s, totalCost: cost, totalInterest: cost, totalTax: 0 };
}

function summarizeSchedule(rows: ScheduleRow[], installment: number): Schedule {
  const sum = (k: keyof ScheduleRow) => rows.reduce((s, r) => s + (r[k] as number), 0);
  const totalInterest = sum("interest");
  const totalTax = sum("tax");
  return {
    rows,
    installment,
    totalPayment: sum("payment"),
    totalInterest,
    totalTax,
    totalCost: totalInterest + totalTax,
  };
}

/** Yıllık bileşik maliyet oranı (vergiler dahil): (1 + r_eff)^12 − 1 */
export function annualCostRate(monthlyRatePct: number, kkdfPct: number, bsmvPct: number) {
  const rEff = (monthlyRatePct / 100) * (1 + (kkdfPct + bsmvPct) / 100);
  return Math.pow(1 + rEff, 12) - 1;
}

/** Taksit tarihleri: ilk taksit gününden itibaren her ay aynı gün (ayda yoksa son gün). */
export function dueDates(firstDue: string, months: number): string[] {
  const day = dayOf(firstDue);
  const start = monthOf(firstDue);
  return Array.from({ length: months }, (_, i) => dateInMonth(addMonths(start, i), day));
}
