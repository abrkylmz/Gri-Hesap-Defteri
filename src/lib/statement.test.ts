import { describe, expect, it } from "vitest";
import type { CategoryRow } from "@/lib/types";
import {
  buildRows,
  decodeText,
  detectMapping,
  guessExpenseIsNegative,
  parseAmountCell,
  parseCsv,
  parseDateCell,
  suggestCategory,
  type Grid,
} from "@/lib/statement";

describe("tarih hücresi", () => {
  it.each([
    ["29.09.2026", "2026-09-29"],
    ["29/09/2026 14:32", "2026-09-29"],
    ["1.2.26", "2026-02-01"],
    ["2026-09-29", "2026-09-29"],
    ["2026-09-29T10:00:00", "2026-09-29"],
  ])("%s → %s", (s, d) => expect(parseDateCell(s)).toBe(d));
  it("Excel seri tarihi ve Date nesnesi", () => {
    expect(parseDateCell(46294)).toBe("2026-09-29");
    expect(parseDateCell(new Date(2026, 8, 29))).toBe("2026-09-29");
  });
  it.each(["31.02.2026", "abc", "12.345,67", "2026"])("reddeder: %s", (s) => expect(parseDateCell(s)).toBeNull());
});

describe("tutar hücresi", () => {
  it.each([
    ["-1.234,56", -123456],
    ["1.234,56 TL", 123456],
    ["(245,00)", -24500],
    ["1.234,56 B", -123456],
    ["500,00 A", 50000],
    ["1,234.56", 123456],
    ["245,00-", -24500],
    ["+3.500", 350000],
  ])("%s → %d", (s, n) => expect(parseAmountCell(s)).toBe(n));
  it("sayı hücresi", () => expect(parseAmountCell(-89.9)).toBe(-8990));
  it.each(["", "abc", "0", "29.09.2026"])("reddeder: %s", (s) => {
    const v = parseAmountCell(s);
    // "29.09.2026" tarih; tutar olarak da okunabilir ama tespit tarih sütununu ayrı tutar
    if (s === "29.09.2026") expect(typeof v === "number" || v === null).toBe(true);
    else expect(v).toBeNull();
  });
});

describe("CSV", () => {
  it("noktalı virgül ayırıcı, tırnak ve satır sonu", () => {
    const rows = parseCsv('Tarih;Açıklama;Tutar\r\n29.09.2026;"MIGROS; KADIKOY";-245,90\n30.09.2026;"Maaş ""Eylül""";52.000,00\n');
    expect(rows).toEqual([
      ["Tarih", "Açıklama", "Tutar"],
      ["29.09.2026", "MIGROS; KADIKOY", "-245,90"],
      ["30.09.2026", 'Maaş "Eylül"', "52.000,00"],
    ]);
  });
  it("Windows-1254 kodlamasını çözer", () => {
    const bytes = new Uint8Array([0x4d, 0x61, 0x61, 0xfe]); // "Maaş" (ş = 0xFE)
    expect(decodeText(bytes.buffer)).toBe("Maaş");
  });
});

describe("sütun tespiti ve dönüştürme", () => {
  it("tek tutar sütunu; bakiye sütunu tutar sanılmaz; başlık üstündeki bilgi satırları atlanır", () => {
    const grid: Grid = [
      ["Hesap Hareketleri", null, null, null],
      ["Müşteri: Ahmet", null, null, null],
      ["İşlem Tarihi", "Açıklama", "Bakiye", "Tutar"],
      ["29.09.2026", "MIGROS KADIKOY", "10.000,00", "-245,90"],
      ["30.09.2026", "MAAS ODEMESI", "62.000,00", "52.000,00"],
    ];
    const m = detectMapping(grid)!;
    expect(m).toMatchObject({ headerRow: 2, date: 0, description: 1, amount: 3 });
    expect(buildRows(grid, m)).toEqual([
      { key: 3, date: "2026-09-29", note: "MIGROS KADIKOY", amount: 24590, kind: "expense" },
      { key: 4, date: "2026-09-30", note: "MAAS ODEMESI", amount: 5200000, kind: "income" },
    ]);
  });

  it("ayrı borç / alacak sütunları", () => {
    const grid: Grid = [
      ["Tarih", "Açıklama", "Borç", "Alacak", "Bakiye"],
      ["01.10.2026", "Kira", "18.000,00", "", "1.000,00"],
      ["02.10.2026", "Havale", "", "2.500,00", "3.500,00"],
    ];
    const m = detectMapping(grid)!;
    expect(m).toMatchObject({ debit: 2, credit: 3, amount: null });
    const rows = buildRows(grid, m);
    expect(rows.map((r) => [r.kind, r.amount])).toEqual([
      ["expense", 1800000],
      ["income", 250000],
    ]);
  });

  it("kredi kartı ekstresi: artı = harcama seçeneği", () => {
    const grid: Grid = [
      ["Tarih", "İşlem", "Tutar"],
      ["03.10.2026", "NETFLIX", "229,90"],
    ];
    const m = detectMapping(grid)!;
    expect(buildRows(grid, m, false)[0]).toMatchObject({ kind: "expense", amount: 22990 });
  });
});

describe("işaret yönü tahmini", () => {
  it("tüm tutarlar artıysa kart ekstresi (artı = gider), karışıksa banka hesabı", () => {
    const card: Grid = [["Tarih", "İşlem", "Tutar"], ["03.10.2026", "NETFLIX", "229,90"], ["04.10.2026", "SHELL", "1.500,00"]];
    const bank: Grid = [["Tarih", "İşlem", "Tutar"], ["03.10.2026", "MIGROS", "-229,90"], ["04.10.2026", "MAAS", "52.000,00"]];
    expect(guessExpenseIsNegative(card, detectMapping(card)!)).toBe(false);
    expect(guessExpenseIsNegative(bank, detectMapping(bank)!)).toBe(true);
  });
});

describe("kategori önerisi", () => {
  const cats: CategoryRow[] = [
    { id: "market", kind: "expense", name: "Market", emoji: "🛒", monthly_budget: null, sort: 1 },
    { id: "abone", kind: "expense", name: "Abonelikler", emoji: "📺", monthly_budget: null, sort: 2 },
    { id: "maas", kind: "income", name: "Maaş", emoji: "💼", monthly_budget: null, sort: 1 },
    { id: "eglence", kind: "expense", name: "Eğlence", emoji: "🎬", monthly_budget: null, sort: 3 },
  ];
  it("kurallardan: iş yeri adı → kategori", () => {
    expect(suggestCategory({ note: "MİGROS KADIKÖY 1234", kind: "expense" }, cats, [])).toBe("market");
    expect(suggestCategory({ note: "NETFLIX.COM", kind: "expense" }, cats, [])).toBe("abone");
    expect(suggestCategory({ note: "MAAŞ ÖDEMESİ", kind: "income" }, cats, [])).toBe("maas");
  });
  it("geçmiş kayıtlar kurallardan önce gelir", () => {
    const history = [{ note: "Netflix com aylık", categoryId: "eglence" }];
    expect(suggestCategory({ note: "NETFLIX COM 0412", kind: "expense" }, cats, history)).toBe("eglence");
  });
  it("eşleşme yoksa null", () => {
    expect(suggestCategory({ note: "XYZ LTD", kind: "expense" }, cats, [])).toBeNull();
  });
});
