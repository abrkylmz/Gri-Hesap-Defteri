import { describe, expect, it } from "vitest";
import { annualCostRate, annuitySchedule, dueDates, fixedSchedule, LOAN_TYPES } from "@/lib/loan";

describe("eşit taksitli kredi", () => {
  it("vergisiz (konut): formülle aynı taksit, anapara tam kapanır", () => {
    // 100.000 ₺, aylık %2, 12 ay → taksit = P·r / (1 − (1+r)^−n)
    const P = 10_000_000;
    const s = annuitySchedule(P, 2, 0, 0, 12);
    const expected = Math.round((P * 0.02) / (1 - Math.pow(1.02, -12)));
    expect(s.installment).toBe(expected); // 9.455,96 ₺
    expect(s.rows).toHaveLength(12);
    expect(s.rows.reduce((n, r) => n + r.principal, 0)).toBe(P);
    expect(s.rows.at(-1)!.remaining).toBe(0);
    expect(s.totalTax).toBe(0);
    expect(s.totalPayment).toBe(P + s.totalInterest);
  });

  it("ihtiyaç kredisi: KKDF + BSMV faizin %30'u kadar", () => {
    const { kkdf, bsmv } = LOAN_TYPES.ihtiyac;
    const s = annuitySchedule(10_000_000, 3, kkdf, bsmv, 24);
    const first = s.rows[0]!;
    expect(first.interest).toBe(300_000); // 100.000 × %3 = 3.000 ₺
    expect(first.tax).toBe(90_000); // faizin %30'u = 900 ₺
    // Vergili aylık oran %3,9 ile annüite
    expect(s.installment).toBe(Math.round((10_000_000 * 0.039) / (1 - Math.pow(1.039, -24))));
    expect(s.rows.reduce((n, r) => n + r.principal, 0)).toBe(10_000_000);
    expect(s.totalCost).toBe(s.totalPayment - 10_000_000);
  });

  it("her taksit = anapara + faiz + vergi; son taksit yuvarlamayı kapatır", () => {
    const s = annuitySchedule(1_234_567, 4.19, 15, 15, 7);
    for (const r of s.rows) expect(r.payment).toBe(r.principal + r.interest + r.tax);
    expect(Math.abs(s.rows.at(-1)!.payment - s.installment)).toBeLessThan(10); // birkaç kuruş fark
  });

  it("faizsiz kredi eşit bölünür", () => {
    const s = annuitySchedule(1_200_000, 0, 0, 0, 12);
    expect(s.installment).toBe(100_000);
    expect(s.totalCost).toBe(0);
  });

  it("taksiti bilinen kredi: toplam maliyet = toplam ödeme − anapara", () => {
    const s = fixedSchedule(500_000, 12, 5_000_000);
    expect(s.totalPayment).toBe(6_000_000);
    expect(s.totalCost).toBe(1_000_000);
    expect(fixedSchedule(500_000, 12, null).totalCost).toBe(0);
  });

  it("yıllık bileşik maliyet", () => {
    expect(annualCostRate(2, 0, 0)).toBeCloseTo(Math.pow(1.02, 12) - 1);
    expect(annualCostRate(3, 15, 15)).toBeCloseTo(Math.pow(1.039, 12) - 1);
  });
});

describe("taksit tarihleri", () => {
  it("her ay aynı gün; o gün olmayan ayda ayın son günü; yıl geçişi", () => {
    expect(dueDates("2026-11-30", 4)).toEqual(["2026-11-30", "2026-12-30", "2027-01-30", "2027-02-28"]);
    expect(dueDates("2026-01-31", 2)).toEqual(["2026-01-31", "2026-02-28"]);
  });
});
