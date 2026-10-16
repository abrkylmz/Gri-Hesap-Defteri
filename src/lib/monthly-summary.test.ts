import { describe, expect, it } from "vitest";
import { monthlySummary, previousMonth } from "./monthly-summary";

describe("ay sonu özeti", () => {
  it("birikim, tasarruf oranı ve en çok harcanan kategori", () => {
    const s = monthlySummary({ month: "2026-09", income: 5_000_000, expense: 3_500_000, top: { name: "Market", total: 1_200_000 }, currency: "TRY" });
    expect(s.title).toMatch(/^Eylül özeti: .*15\.000.* biriktirdin$/);
    expect(s.body).toMatch(/tasarruf %30/);
    expect(s.body).toMatch(/En çok Market/);
  });
  it("açık verilen ay", () => {
    const s = monthlySummary({ month: "2026-12", income: 1_000_000, expense: 1_500_000, top: null, currency: "TRY" });
    expect(s.title).toMatch(/^Aralık özeti: giderler gelirini .*5\.000.* aştı$/);
    expect(s.body).not.toMatch(/tasarruf/);
  });
  it("önceki ay; yıl dönümü", () => {
    expect(previousMonth("2026-10-01")).toBe("2026-09");
    expect(previousMonth("2027-01-02")).toBe("2026-12");
  });
});
