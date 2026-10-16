import { describe, expect, it } from "vitest";
import {
  bankKey,
  cardPeriod,
  daysUntil,
  filterBanks,
  nextDayOn,
  searchKey,
  summarizeLimits,
  TURKISH_BANKS,
  type CreditLimit,
} from "@/lib/limits";

const row = (p: Partial<CreditLimit>): CreditLimit => ({
  id: Math.random().toString(),
  bank: "Garanti",
  kind: "card",
  name: null,
  limit: 0,
  used: null,
  updated_ms: 0,
  ...p,
});

describe("limit özeti", () => {
  const rows = [
    row({ bank: "Garanti", kind: "card", limit: 5000000, used: 1200000 }),
    row({ bank: "garanti ", kind: "overdraft", limit: 2000000 }),
    row({ bank: "Akbank", kind: "card", limit: 3000000, used: 3500000 }),
    row({ bank: "İş Bankası", kind: "overdraft", limit: 1000000, used: 0 }),
  ];
  const s = summarizeLimits(rows);

  it("toplamlar türe göre", () => {
    expect(s.total).toBe(11000000);
    expect(s.card).toBe(8000000);
    expect(s.overdraft).toBe(3000000);
  });
  it("kullanılabilir limit yalnızca borcu girilenlerden; aşım eksiye düşürmez", () => {
    expect(s.used).toBe(4700000);
    expect(s.trackedLimit).toBe(9000000);
    expect(s.available).toBe(3800000 + 0 + 1000000);
  });
  it("aynı banka (büyük/küçük harf, boşluk) tek grupta; büyükten küçüğe", () => {
    expect(s.banks.map((b) => [b.bank, b.total])).toEqual([
      ["Garanti", 7000000],
      ["Akbank", 3000000],
      ["İş Bankası", 1000000],
    ]);
    expect(s.banks[0]!.items.map((i) => i.kind)).toEqual(["card", "overdraft"]);
  });
  it("Türkçe büyük harf", () => {
    expect(bankKey("İŞ BANKASI")).toBe(bankKey("iş bankası"));
  });
});

describe("banka arama", () => {
  it("Türkçe karakter ve büyük/küçük harf duyarsız", () => {
    expect(searchKey("  İŞ   Bankası ")).toBe("is bankasi");
    expect(searchKey("Şekerbank")).toBe("sekerbank");
    expect(searchKey("Yapı Kredi")).toBe("yapi kredi");
  });
  it("kelime başı eşleşmeler önce; içinde geçenler sonra", () => {
    expect(filterBanks(TURKISH_BANKS, "is")).toContain("İş Bankası");
    expect(filterBanks(TURKISH_BANKS, "kat")[0]).toBe("Dünya Katılım");
    expect(filterBanks(TURKISH_BANKS, "ziraat")).toEqual(["Ziraat Bankası", "Ziraat Katılım"]);
    // İçinde geçenler, listedeki sıralarını korur
    expect(filterBanks(["Akbank", "Fibabanka", "QNB"], "bank")).toEqual(["Akbank", "Fibabanka"]);
    expect(filterBanks(TURKISH_BANKS, "")).toHaveLength(TURKISH_BANKS.length);
    expect(filterBanks(TURKISH_BANKS, "xyz")).toEqual([]);
  });
});

describe("kredi kartı dönemi", () => {
  it("bu ayki gün geçmediyse bu ay", () => {
    expect(nextDayOn(25, "2026-10-16")).toBe("2026-10-25");
    expect(nextDayOn(16, "2026-10-16")).toBe("2026-10-16");
  });
  it("geçtiyse gelecek ay; yıl dönümü", () => {
    expect(nextDayOn(5, "2026-10-16")).toBe("2026-11-05");
    expect(nextDayOn(5, "2026-12-20")).toBe("2027-01-05");
  });
  it("kısa ayda ayın son günü", () => {
    expect(nextDayOn(31, "2027-02-10")).toBe("2027-02-28");
    expect(nextDayOn(30, "2027-01-31")).toBe("2027-02-28");
  });
  it("son ödemeye kalan gün", () => {
    expect(daysUntil("2026-10-16", "2026-10-25")).toBe(9);
    expect(cardPeriod({ kind: "card", statement_day: 15, due_day: 25 }, "2026-10-16")).toEqual({
      statement: "2026-11-15",
      due: "2026-10-25",
      daysToDue: 9,
    });
  });
  it("ek hesap ya da gün yoksa dönem yok", () => {
    expect(cardPeriod({ kind: "overdraft", statement_day: 15, due_day: 25 }, "2026-10-16")).toBeNull();
    expect(cardPeriod({ kind: "card", statement_day: null, due_day: null }, "2026-10-16")).toBeNull();
  });
});
