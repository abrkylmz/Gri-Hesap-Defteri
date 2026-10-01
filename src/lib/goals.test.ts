import { describe, expect, it } from "vitest";
import { goalProgress, monthlyNeeded, monthsLeft, type Goal } from "@/lib/goals";

const g = (p: Partial<Goal>): Goal => ({ id: "1", name: "Araba", icon: "car", target: 50_000_000, saved: 14_500_000, due: null, ...p });

describe("finansal hedefler", () => {
  it("ilerleme %0–100 arası", () => {
    expect(goalProgress(g({}))).toBeCloseTo(0.29);
    expect(goalProgress(g({ saved: 60_000_000 }))).toBe(1);
  });
  it("kalan ay: bu ay dahil, en az 1", () => {
    expect(monthsLeft("2027-06-30", "2026-10-02")).toBe(9);
    expect(monthsLeft("2026-10-20", "2026-10-02")).toBe(1);
    expect(monthsLeft(null, "2026-10-02")).toBeNull();
  });
  it("aylık gereken: kalan / kalan ay, yukarı yuvarlanır", () => {
    expect(monthlyNeeded(g({ due: "2027-06-30" }), "2026-10-02")).toBe(Math.ceil(35_500_000 / 9));
    expect(monthlyNeeded(g({ saved: 50_000_000, due: "2027-06-30" }), "2026-10-02")).toBe(0);
    expect(monthlyNeeded(g({}), "2026-10-02")).toBeNull();
    expect(monthlyNeeded(g({ due: "2026-01-01" }), "2026-10-02")).toBeNull();
  });
});
