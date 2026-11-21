import { describe, expect, it } from "vitest";
import { analyzeMonth, expectedNextMonth } from "@/lib/report";
import type { RecurringRow, TransactionRow } from "@/lib/types";

let n = 0;
const tx = (p: Partial<TransactionRow> & Pick<TransactionRow, "occurred_on">): TransactionRow => ({
  id: `t${++n}`,
  kind: "expense",
  amount: 1000,
  category_id: "market",
  note: null,
  recurring_id: null,
  remind_days: null,
  paid: false,
  template_id: null,
  loan_id: null,
  fx_code: null,
  fx_amount: null,
  fx_rate: null,
  created_at: "",
  ...p,
});

describe("aylık rapor çözümlemesi", () => {
  const current = [
    tx({ occurred_on: "2026-10-02", amount: 50000, kind: "income", category_id: "maas" }),
    tx({ occurred_on: "2026-10-05", amount: 20000, category_id: "kira", recurring_id: "r1" }), // Pazartesi, sabit
    tx({ occurred_on: "2026-10-05", amount: 3000 }),
    tx({ occurred_on: "2026-10-10", amount: 7000 }), // Cumartesi
    tx({ occurred_on: "2026-10-12", amount: null }), // tutar bekleniyor: hesaba girmez
  ];
  const previous = [
    tx({ occurred_on: "2026-09-03", amount: 40000, kind: "income", category_id: "maas" }),
    tx({ occurred_on: "2026-09-05", amount: 20000, category_id: "kira" }),
    tx({ occurred_on: "2026-09-08", amount: 5000, category_id: "eglence" }),
  ];
  const trend = [
    { month: "2026-08", income: 30000, expense: 10000 },
    { month: "2026-09", income: 40000, expense: 25000 },
    { month: "2026-10", income: 50000, expense: 30000 },
  ];
  const a = analyzeMonth({
    month: "2026-10",
    today: "2026-11-21",
    current,
    previous,
    trend,
    budgets: new Map([["market", 8000]]),
  });

  it("geçen aya göre değişim", () => {
    expect(a.expense).toEqual({ cur: 30000, prev: 25000, diff: 5000, pct: 0.2 });
    expect(a.income.pct).toBe(0.25);
    expect(a.net).toMatchObject({ cur: 20000, prev: 15000 });
  });

  it("kategoriler: geçen ay, pay, bütçe; bu ay harcanmayan da görünür", () => {
    const market = a.categories.find((c) => c.categoryId === "market")!;
    expect(market).toMatchObject({ total: 10000, count: 2, prev: 0, budget: 8000 });
    expect(market.share).toBeCloseTo(1 / 3);
    expect(a.categories.find((c) => c.categoryId === "eglence")).toMatchObject({ total: 0, prev: 5000 });
  });

  it("günlük, haftanın günleri, sabit/değişken, en büyük giderler, bütçe", () => {
    expect(a.daily.dayCount).toBe(31);
    expect(a.daily.maxDay).toEqual({ date: "2026-10-05", amount: 23000 });
    expect(a.daily.noSpendDays).toBe(29);
    expect(a.daily.average).toBe(Math.round(30000 / 31));
    expect(a.weekdays[0]).toBe(23000); // Pazartesi
    expect(a.weekdays[5]).toBe(7000); // Cumartesi
    expect(a.fixed).toBe(20000);
    expect(a.variable).toBe(10000);
    expect(a.top.map((t) => t.amount)).toEqual([20000, 7000, 3000]);
    expect(a.budget).toEqual({ total: 8000, spent: 10000, over: 1, count: 1 });
    expect(a.average).toEqual({ income: 35000, expense: 17500, months: 2 });
  });

  it("içinde bulunulan ayda yalnızca bugüne kadarki günler sayılır", () => {
    const now = analyzeMonth({
      month: "2026-11",
      today: "2026-11-21",
      current: [],
      previous: [],
      trend: [],
      budgets: new Map(),
    });
    expect(now.daily.dayCount).toBe(21);
    expect(now.daily.maxDay).toBeNull();
  });
});

describe("gelecek ay beklenen ödemeler", () => {
  const recurring: RecurringRow[] = [
    {
      id: "r1",
      kind: "expense",
      amount: 20000,
      category_id: "kira",
      note: "Kira",
      day_of_month: 5,
      starts_on: "2026-01-01",
      active: true,
      remind_days: null,
    },
    {
      id: "r2",
      kind: "expense",
      amount: 900,
      category_id: null,
      note: "Netflix",
      day_of_month: 31,
      starts_on: "2026-01-01",
      active: true,
      remind_days: null,
    },
    {
      id: "r3",
      kind: "expense",
      amount: 1,
      category_id: null,
      note: "Pasif",
      day_of_month: 1,
      starts_on: "2026-01-01",
      active: false,
      remind_days: null,
    },
    {
      id: "r4",
      kind: "income",
      amount: 1,
      category_id: null,
      note: "Maaş",
      day_of_month: 1,
      starts_on: "2026-01-01",
      active: true,
      remind_days: null,
    },
  ];
  it("yazılmış ödenmemiş giderler + yazılmamış düzenliler; çift sayılmaz", () => {
    const next = [
      tx({ occurred_on: "2026-12-05", amount: 20000, recurring_id: "r1", note: "Kira" }),
      tx({ occurred_on: "2026-12-10", amount: 1500, loan_id: "l1", note: "Taksit" }),
      tx({ occurred_on: "2026-12-11", amount: 999, paid: true }),
    ];
    const e = expectedNextMonth("2026-12", next, recurring);
    expect(e.items.map((i) => i.note)).toEqual(["Kira", "Taksit", "Netflix"]);
    expect(e.items.at(-1)!.date).toBe("2026-12-31");
    expect(e.total).toBe(22400);
  });
});

describe("madde madde liste", () => {
  it("kategoriye göre gruplar, ara toplam ve tarih sırası; tutarı bekleyen dahil ama toplama girmez", async () => {
    const { itemize } = await import("@/lib/report");
    const list = [
      tx({ occurred_on: "2026-10-09", amount: 300, category_id: "market" }),
      tx({ occurred_on: "2026-10-02", amount: 500, category_id: "market" }),
      tx({ occurred_on: "2026-10-05", amount: 2000, category_id: "kira" }),
      tx({ occurred_on: "2026-10-07", amount: null, category_id: null }),
      tx({ occurred_on: "2026-10-01", amount: 9000, kind: "income", category_id: "maas" }),
    ];
    const e = itemize(list, "expense");
    expect(e.groups.map((g) => [g.categoryId, g.total, g.items.length])).toEqual([
      ["kira", 2000, 1],
      ["market", 800, 2],
      [null, 0, 1],
    ]);
    expect(e.groups[1]!.items.map((t) => t.occurred_on)).toEqual(["2026-10-02", "2026-10-09"]);
    expect(e).toMatchObject({ total: 2800, count: 4 });
    expect(itemize(list, "income")).toMatchObject({ total: 9000, count: 1 });
  });
});

describe("yıllık rapor çözümlemesi", () => {
  it("aylar, geçen yıla göre değişim, ortalama, öne çıkan aylar, kategoriler", async () => {
    const { analyzeYear } = await import("@/lib/report");
    const a = analyzeYear({
      year: 2026,
      today: "2026-11-21",
      transactions: [
        tx({ occurred_on: "2026-01-15", amount: 10000, kind: "income", category_id: "maas" }),
        tx({ occurred_on: "2026-01-20", amount: 4000, category_id: "kira", recurring_id: "r1" }),
        tx({ occurred_on: "2026-03-02", amount: 10000, kind: "income", category_id: "maas" }),
        tx({ occurred_on: "2026-03-03", amount: 9000, category_id: "market" }),
        tx({ occurred_on: "2026-03-04", amount: null }),
      ],
      previous: {
        months: [
          { month: "2025-05", income: 10000, expense: 11000 },
          { month: "2025-12", income: 99000, expense: 99000 }, // aynı dönem dışında: sayılmaz
        ],
        categories: [
          { categoryId: "kira", kind: "expense", total: 5000, count: 1 },
          { categoryId: "eglence", kind: "expense", total: 6000, count: 2 },
        ],
      },
    });
    expect(a.months[0]).toEqual({ month: "2026-01", income: 10000, expense: 4000 });
    expect(a.months[2]).toMatchObject({ income: 10000, expense: 9000 });
    expect(a.expense).toMatchObject({ cur: 13000, prev: 11000, diff: 2000 });
    expect(a.net).toMatchObject({ cur: 7000, prev: -1000 });
    expect(a.elapsed).toBe(11);
    expect(a.samePeriod).toBe(true);
    expect(a.average.expense).toBe(Math.round(13000 / 11));
    expect(a.best?.month).toBe("2026-01");
    expect(a.worst?.month).toBe("2026-03");
    expect(a.heaviest?.month).toBe("2026-03");
    expect(a.expenseCategories.map((c) => [c.categoryId, c.total, c.prev])).toEqual([
      ["market", 9000, 0],
      ["kira", 4000, 5000],
      ["eglence", 0, 6000],
    ]);
    expect(a.fixed).toBe(4000);
    expect(a.top.map((t) => t.amount)).toEqual([9000, 4000]);
    expect(a).toMatchObject({ count: 5, expenseCount: 2, pendingAmounts: 1 });
  });
});
