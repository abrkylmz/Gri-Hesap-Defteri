import { describe, expect, it } from "vitest";
import {
  combineCryptoPrices,
  cryptoValue,
  normalizeSymbol,
  parseCoinbaseRates,
  parseCryptoAmount,
  parseOkxTickers,
  priceText,
  type CryptoHolding,
} from "@/lib/crypto";

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
    const prices = { BTC: { price: 4_000_000, usdt: null, change: null, updatedMs: 0 } };
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

describe("kripto kaynak birleştirme", () => {
  const okxJson = {
    data: [
      { instId: "PI-USDT", last: "0.09", open24h: "0.0923" },
      { instId: "BTC-USDT", last: "83747", open24h: "83618.4" },
      { instId: "PI-USDC", last: "0.5", open24h: "0.5" },
    ],
  };
  it("OKX: yalnız istenen USDT çiftleri", () => {
    const r = parseOkxTickers(okxJson, ["PI", "BTC", "ETH"]);
    expect(r.PI).toEqual({ last: 0.09, open: 0.0923 });
    expect(r).not.toHaveProperty("ETH");
    expect(parseOkxTickers({ data: "x" }, ["PI"])).toEqual({});
  });
  it("PI/USDT → TL ve günlük değişim; OKX'te olmayan Coinbase'den; USDT kendisi", () => {
    const okx = parseOkxTickers(okxJson, ["PI", "BTC"]);
    const r = combineCryptoPrices(["PI", "XYZ", "USDT", "YOK"], { XYZ: 98, USDT: 49 }, okx, 49);
    expect(r.PI!.price).toBeCloseTo(4.41, 6);
    expect(r.PI!.usdt).toBe(0.09);
    expect(r.PI!.change).toBeCloseTo(0.09 / 0.0923 - 1, 9);
    expect(r.XYZ).toEqual({ price: 98, usdt: 2, change: null });
    expect(r.USDT).toEqual({ price: 49, usdt: 1, change: null });
    expect(r).not.toHaveProperty("YOK");
  });
  it("USDT/TL kuru yoksa OKX fiyatı TL'ye çevrilemez", () => {
    const okx = parseOkxTickers(okxJson, ["PI"]);
    expect(combineCryptoPrices(["PI"], {}, okx, null)).toEqual({});
  });
});
