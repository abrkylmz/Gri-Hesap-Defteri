import { describe, expect, it } from "vitest";
import { fundStats, fundTotals, type Fund } from "./funds";

const f = (id: string, invested: number): Fund => ({ id, name: id, code: null, invested, sort: 0 });

describe("fon getirisi", () => {
  const stats = fundStats(
    [f("a", 100_000_00), f("b", 50_000_00), f("c", 10_000_00)],
    [
      { fundId: "a", day: "2026-11-07", value: 110_000_00 },
      { fundId: "a", day: "2026-11-09", value: 112_200_00 },
      { fundId: "b", day: "2026-11-09", value: 48_000_00 },
    ],
  );
  it("günlük getiri bir önceki girişe göre", () => {
    expect(stats[0]!.daily).toBe(2_200_00);
    expect(stats[0]!.dailyPct).toBeCloseTo(0.02);
    expect(stats[0]!.prevDay).toBe("2026-11-07");
  });
  it("toplam getiri yatırılana göre (zarar eksi)", () => {
    expect(stats[0]!.total).toBe(12_200_00);
    expect(stats[0]!.totalPct).toBeCloseTo(0.122);
    expect(stats[1]!.total).toBe(-2_000_00);
    expect(stats[1]!.daily).toBeNull();
  });
  it("değeri girilmemiş fon toplama katılmaz", () => {
    expect(stats[2]!.value).toBeNull();
    const t = fundTotals(stats);
    expect(t.value).toBe(160_200_00);
    expect(t.invested).toBe(150_000_00);
    expect(t.total).toBe(10_200_00);
    expect(t.daily).toBe(2_200_00);
    expect(t.dailyPct).toBeCloseTo(0.02);
  });
});
