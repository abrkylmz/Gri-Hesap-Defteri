import { describe, expect, it } from "vitest";
import { bankKey, summarizeLimits, type CreditLimit } from "@/lib/limits";

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
