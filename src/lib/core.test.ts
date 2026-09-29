import { describe, expect, it } from "vitest";
import type { RecurringRow, TransactionRow } from "@/lib/types";
import { addMonths, dateInMonth, daysInMonth, isMonthKey, shiftDate } from "@/lib/dates";
import { groupByDate, normalize, pace, summarize, upcomingRecurring } from "@/lib/ledger";
import { formatMoney, minorToInput, moneyParts, toMinor } from "@/lib/money";
import { pressKey } from "@/lib/keypad";

describe("toMinor", () => {
  it.each([
    ["1250", 125000],
    ["1250,5", 125050],
    ["1250,50", 125050],
    ["1.250,50", 125050],
    ["1,250.50", 125050],
    ["1250.5", 125050],
    ["1.250", 125000],
    ["0,01", 1],
    [" ₺ 12 ", 1200],
    [",5", 50],
  ])("%s → %i", (input, expected) => {
    expect(toMinor(input)).toBe(expected);
  });

  it.each(["", "0", "0,00", "abc", "12,345", "-5", "1234567890", "1.2.3,456"])(
    "reddeder: %s",
    (input) => {
      expect(toMinor(input)).toBeNull();
    },
  );

  it("minorToInput ile gidiş-dönüş", () => {
    for (const v of [1, 10, 99, 100, 125050, 125000, 99_999_999_999]) {
      expect(toMinor(minorToInput(v))).toBe(v);
    }
  });
});

describe("para biçimi", () => {
  it("işaret ve parçalar", () => {
    expect(formatMoney(-125050, "TRY")).toMatch(/^−₺1\.250,50$/);
    expect(formatMoney(100, "TRY", { sign: true })).toBe("+₺1,00");
    const p = moneyParts(123456789, "TRY");
    expect(p).toMatchObject({ int: "1.234.567", frac: "89", symbol: "₺", negative: false });
  });
});

describe("pressKey", () => {
  const type = (keys: string) =>
    [...keys].reduce((s, k) => pressKey(s, (k === "<" ? "back" : k) as Parameters<typeof pressKey>[1]), "");
  it("olağan giriş", () => expect(type("1250,5")).toBe("1250,5"));
  it("baştaki sıfırı yutar", () => expect(type("007")).toBe("7"));
  it("tek virgül, en fazla 2 ondalık", () => expect(type("1,2,345")).toBe("1,23"));
  it("virgülle başlarsa 0, olur", () => expect(type(",5")).toBe("0,5"));
  it("geri silme", () => expect(type("12<<3")).toBe("3"));
  it("9 haneyi aşmaz", () => expect(type("12345678901")).toBe("123456789"));
});

describe("tarihler", () => {
  it("ay aritmetiği yıl sınırında", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-03", -14)).toBe("2025-01");
  });
  it("ay uzunlukları ve kırpma", () => {
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(dateInMonth("2026-02", 31)).toBe("2026-02-28");
    expect(dateInMonth("2026-09", 5)).toBe("2026-09-05");
  });
  it("gün kaydırma ve doğrulama", () => {
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-09")).toBe(true);
    expect(isMonthKey(["2026-09"])).toBe(false);
  });
});

const tx = (p: Partial<TransactionRow>): TransactionRow => ({
  id: crypto.randomUUID(),
  kind: "expense",
  amount: 100,
  category_id: null,
  note: null,
  occurred_on: "2026-09-10",
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

describe("özet", () => {
  const rows = [
    tx({ occurred_on: "2026-09-12", amount: 5000, category_id: "a" }),
    tx({ occurred_on: "2026-09-12", amount: 1500, category_id: "b" }),
    tx({ occurred_on: "2026-09-01", amount: 3000, category_id: "a" }),
    tx({ occurred_on: "2026-09-01", amount: 100000, kind: "income", category_id: "s" }),
  ];

  it("toplamlar, günlük dağılım ve kategori sırası", () => {
    const s = summarize(rows, "2026-09");
    expect(s).toMatchObject({ income: 100000, expense: 9500, net: 90500 });
    expect(s.daily).toHaveLength(30);
    expect(s.daily[11]).toMatchObject({ date: "2026-09-12", expense: 6500, income: 0 });
    expect(s.daily[0]).toMatchObject({ expense: 3000, income: 100000 });
    expect(s.categories.expense.map((c) => [c.categoryId, c.total, c.count])).toEqual([
      ["a", 8000, 2],
      ["b", 1500, 1],
    ]);
  });

  it("tempo: içinde bulunulan ay için tahmin", () => {
    const s = summarize(rows, "2026-09");
    const p = pace("2026-09", "2026-09-15", s.expense, s.daily, 10000);
    expect(p.dailyAverage).toBe(Math.round(9500 / 15));
    expect(p.projected).toBe(19000);
    expect(p.changeVsPrev).toBeCloseTo(0.9);
    expect(p.busiest?.date).toBe("2026-09-12");
  });

  it("tempo: geçmiş ayda tahmin yok, gelecek ayda ortalama sıfır", () => {
    expect(pace("2026-08", "2026-09-15", 3100, [], 0).projected).toBeNull();
    expect(pace("2026-10", "2026-09-15", 0, [], 0).dailyAverage).toBe(0);
  });

  it("tutarı bekleyen kayıt toplamlara katılmaz ama sayılır", () => {
    const s = summarize([...rows, tx({ occurred_on: "2026-09-20", amount: null })], "2026-09");
    expect(s).toMatchObject({ income: 100000, expense: 9500, pendingAmounts: 1 });
    expect(s.daily[19]).toMatchObject({ expense: 0 });
    expect(s.categories.expense.reduce((n, c) => n + c.count, 0)).toBe(3);
  });

  it("güne göre gruplama ve gün neti", () => {
    const g = groupByDate(rows);
    expect(g.map((x) => [x.date, x.net])).toEqual([
      ["2026-09-12", -6500],
      ["2026-09-01", 97000],
    ]);
  });
});

describe("yaklaşan düzenli kayıtlar", () => {
  const r = (p: Partial<RecurringRow>): RecurringRow => ({
    id: crypto.randomUUID(),
    kind: "expense",
    amount: 100,
    category_id: null,
    note: null,
    day_of_month: 1,
    starts_on: "2026-01-01",
    active: true,
    remind_days: null,
    ...p,
  });

  it("yalnızca bugünden sonraki, aktif ve başlamış olanlar", () => {
    const list = upcomingRecurring(
      [
        r({ day_of_month: 5, note: "geçti" }),
        r({ day_of_month: 20, note: "kira" }),
        r({ day_of_month: 31, note: "ay sonu" }),
        r({ day_of_month: 25, active: false }),
        r({ day_of_month: 28, starts_on: "2026-10-01" }),
      ],
      "2026-09-15",
    );
    expect(list.map((x) => [x.note, x.date])).toEqual([
      ["kira", "2026-09-20"],
      ["ay sonu", "2026-09-30"],
    ]);
  });
});

describe("arama normalizasyonu", () => {
  it("Türkçe karakter ve büyük harf duyarsız", () => {
    expect(normalize("IŞIK Faturası")).toBe(normalize("ışık faturasi"));
    expect(normalize("İnternet")).toContain("internet");
  });
});
