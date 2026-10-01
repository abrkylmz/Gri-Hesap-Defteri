import { describe, expect, it } from "vitest";
import { cryptoValue, normalizeSymbol, parseCoinbaseRates, parseCryptoAmount, priceText, type CryptoHolding } from "@/lib/crypto";

const h = (p: Partial<CryptoHolding>): CryptoHolding => ({
  id: "1", symbol: "BTC", name: null, amount: 1, manual_price: null, cost: null, ...p,
});

describe("kripto", () => {
  it("miktar: 10 ondalığa kadar, Türkçe biçim", () => {
    expect(parseCryptoAmount("0,0153")).toBe(0.0153);
    expect(parseCryptoAmount("1.500.000")).toBe(1500000);
    expect(parseCryptoAmount("1.500,5")).toBe(1500.5);
    expect(parseCryptoAmount("0.00000001")).toBe(0.00000001);
    expect(parseCryptoAmount("0")).toBeNull();
    expect(parseCryptoAmount("abc")).toBeNull();
    expect(parseCryptoAmount("0,12345678901")).toBeNull(); // 11 ondalık
  });
  it("sembol temizliği", () => {
    expect(normalizeSymbol(" btc ")).toBe("BTC");
    expect(normalizeSymbol("$pepe")).toBe("PEPE");
  });
  it("Coinbase oranları ters çevrilir; olmayan sembol atlanır", () => {
    const json = { data: { currency: "TRY", rates: { BTC: "0.00000025", USDT: "0.0204", XYZ: "0" } } };
    const r = parseCoinbaseRates(json, ["BTC", "USDT", "XYZ", "TRX"]);
    expect(r.BTC).toBeCloseTo(4_000_000, 2);
    expect(r.USDT).toBeCloseTo(49.0196, 3);
    expect(r).not.toHaveProperty("XYZ");
    expect(r).not.toHaveProperty("TRX");
    expect(parseCoinbaseRates({ hata: 1 }, ["BTC"])).toEqual({});
  });
  it("değer: elle girilen fiyat önceliklidir; fiyat yoksa null", () => {
    const prices = { BTC: { price: 4_000_000, updatedMs: 0 } };
    expect(cryptoValue(h({ amount: 0.5 }), prices)).toBe(200_000_000);
    expect(cryptoValue(h({ amount: 0.5, manual_price: 3_000_000 }), prices)).toBe(150_000_000);
    expect(cryptoValue(h({ symbol: "TRX", amount: 10 }), prices)).toBeNull();
    // Çok küçük fiyat: 10 milyon PEPE × 0,000244 TL = 2.440 TL
    expect(cryptoValue(h({ symbol: "PEPE", amount: 10_000_000, manual_price: 0.000244 }), {})).toBe(244_000);
  });
  it("fiyat metni küçük fiyatlarda hassas", () => {
    expect(priceText(4093631.5124)).toBe("4.093.631,51");
    expect(priceText(0.00024412)).toMatch(/^0,000244/);
  });
});
