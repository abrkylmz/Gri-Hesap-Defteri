import { describe, expect, it } from "vitest";
import { assetsTotal, changeSince, debtsTotal } from "./net-worth";

describe("net varlık", () => {
  it("nakit + döviz/altın + kripto", () => {
    const total = assetsTotal(
      [{ id: "w", name: "Banka", kind: "bank", balance: 1_000_000, updated_ms: 0 }],
      [{ id: "h", asset: "USD", amount: 100, cost: null, note: null } as never],
      [{ code: "USD", rate: 40, change: null, updatedMs: 0 }],
      [{ id: "c", symbol: "BTC", name: "Bitcoin", amount: 0.01, manual_price: null, cost: null } as never],
      { BTC: { price: 4_000_000, usdt: null, change: null, updatedMs: 0 } },
    );
    expect(total).toBe(1_000_000 + 400_000 + 4_000_000);
  });
  it("kuru olmayan varlık sayılmaz", () => {
    expect(assetsTotal([], [{ id: "h", asset: "GAU", amount: 5 } as never], [], [], {})).toBe(0);
  });
  it("borç: girilmiş kart borcu + kalan taksit", () => {
    const limits = [{ used: 250_000 }, { used: null }, { used: 50_000 }] as never;
    expect(debtsTotal(limits, 1_000_000)).toBe(1_300_000);
  });
  it("30 gün öncesine göre değişim", () => {
    const pts = [
      { day: "2026-09-01", assets: 1_000_000, debts: 200_000 },
      { day: "2026-09-20", assets: 1_100_000, debts: 200_000 },
      { day: "2026-10-15", assets: 1_300_000, debts: 100_000 },
    ];
    const c = changeSince(pts, 1_200_000, 30, "2026-10-16");
    expect(c?.day).toBe("2026-09-01");
    expect(c?.diff).toBe(400_000);
    expect(c?.ratio).toBeCloseTo(0.5);
    expect(changeSince(pts, 1, 90, "2026-10-16")).toBeNull();
  });
});
