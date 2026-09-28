import { describe, expect, it } from "vitest";
import { allocationStats, buildPortfolio, normalizeCode, returnRate, type Ipo, type IpoSale } from "@/lib/ipo";

const ipo = (p: Partial<Ipo> = {}): Ipo => ({
  id: "altny",
  code: "ALTNY",
  name: "Altınay Savunma",
  offer_price: 3200, // 32,00 ₺
  listed_on: "2026-09-01",
  current_price: null,
  price_updated_ms: null,
  ...p,
});
const sale = (p: Partial<IpoSale>): IpoSale => ({
  id: "s" + Math.random(),
  allocation_id: "a1",
  lots: 10,
  price: 3520,
  commission: 0,
  sold_on: "2026-09-02",
  ...p,
});

describe("katılım hesabı", () => {
  it("hiç satılmamış, fiyat girilmemiş: maliyet = değer, kâr sıfır", () => {
    const s = allocationStats({ id: "a1", ipo_id: "altny", account_id: "h1", lots: 100 }, ipo(), []);
    expect(s).toMatchObject({ cost: 320000, remainingLots: 100, openValue: 320000, realized: 0, unrealized: 0, total: 0 });
  });

  it("parça parça satış + komisyon + eldeki lotlar güncel fiyattan", () => {
    const s = allocationStats(
      { id: "a1", ipo_id: "altny", account_id: "h1", lots: 100 },
      ipo({ current_price: 4000 }),
      [sale({ lots: 60, price: 3520, commission: 150 }), sale({ lots: 20, price: 3870, commission: 50 })],
    );
    // Satış: 60×35,20 + 20×38,70 − 2,00 komisyon = 2112 + 774 − 2 = 2884,00 ₺
    expect(s.proceeds).toBe(288400);
    // Gerçekleşen: 2884 − 80×32 = 2884 − 2560 = 324,00 ₺
    expect(s.realized).toBe(32400);
    // Eldeki 20 lot × 40,00 = 800 ₺; maliyet 640 ₺ → +160 ₺
    expect(s.openValue).toBe(80000);
    expect(s.unrealized).toBe(16000);
    expect(s.total).toBe(48400);
    expect(returnRate(s)).toBeCloseTo(484 / 3200);
  });

  it("zararına satış negatif kâr verir", () => {
    const s = allocationStats({ id: "a1", ipo_id: "altny", account_id: "h1", lots: 10 }, ipo(), [
      sale({ lots: 10, price: 2900 }),
    ]);
    expect(s.realized).toBe(-3000);
    expect(s.remainingLots).toBe(0);
    expect(s.openValue).toBe(0);
  });
});

describe("portföy", () => {
  it("hesap, halka arz ve toplam düzeyinde toplar", () => {
    const ipos = [ipo(), ipo({ id: "xyz", code: "XYZ", offer_price: 1000, current_price: 1500 })];
    const allocations = [
      { id: "a1", ipo_id: "altny", account_id: "h1", lots: 100 },
      { id: "a2", ipo_id: "altny", account_id: "h2", lots: 50 },
      { id: "a3", ipo_id: "xyz", account_id: "h1", lots: 10 },
    ];
    const sales = [sale({ allocation_id: "a1", lots: 100, price: 3520 })];
    const p = buildPortfolio(ipos, allocations, sales);

    expect(p.total.cost).toBe(100 * 3200 + 50 * 3200 + 10 * 1000);
    expect(p.total.realized).toBe(100 * 320);
    expect(p.total.unrealized).toBe(10 * 500);
    expect(p.total.openValue).toBe(50 * 3200 + 10 * 1500);
    expect(p.byAccount.get("h1")?.total).toBe(32000 + 5000);
    expect(p.byAccount.get("h2")?.total).toBe(0);
    expect(p.byIpo.get("altny")?.lots).toBe(150);
    expect(p.cells.get("altny")?.get("h1")?.stats.remainingLots).toBe(0);
  });

  it("silinmiş halka arza ait yetim katılımı yok sayar", () => {
    const p = buildPortfolio([], [{ id: "a1", ipo_id: "yok", account_id: "h1", lots: 5 }], []);
    expect(p.total.cost).toBe(0);
  });
});

describe("hisse kodu", () => {
  it("büyük harfe çevirir, Türkçe İ'yi ve boşlukları düzeltir", () => {
    expect(normalizeCode(" altny ")).toBe("ALTNY");
    expect(normalizeCode("kimya")).toBe("KIMYA");
    expect(normalizeCode("a.b-c 1")).toBe("ABC1");
  });
});
