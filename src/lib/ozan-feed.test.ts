import { describe, expect, it } from "vitest";
import { parseOzan, parseOzanPrice } from "@/lib/ozan-feed";

// Örnek yanıtlar ozandoviz.com'un gerçek çıktısından (21.11.2026) kısaltılmıştır.
describe("Ozan Döviz fiyatları", () => {
  it("sayı biçimi: virgül binlik, nokta ondalık", () => {
    expect(parseOzanPrice("6,027.25")).toBe(6027.25);
    expect(parseOzanPrice("50.935")).toBe(50.935);
    expect(parseOzanPrice("0.3217")).toBe(0.3217);
    expect(parseOzanPrice("203,628")).toBe(203628);
    expect(parseOzanPrice("")).toBeNull();
    expect(parseOzanPrice("0")).toBeNull();
    expect(parseOzanPrice(12)).toBeNull();
  });

  it("döviz: satış fiyatı, etiketten (anahtardan değil) eşlenir", () => {
    const feed = {
      data: {
        USDTRY: { code: "USD/TL", name: "USDTRY", alis: "50.745", satis: "50.935" },
        GBPPARITE: { code: "GBP/TL", name: "GBPPARITE", alis: "66.055", satis: "66.775" },
        USDCHF: { code: "CHF/TL", name: "USDCHF", alis: "59.842", satis: "60.547" },
        USDJPY: { code: "JPY/TL", name: "USDJPY", alis: "0.3156", satis: "0.3217" },
      },
    };
    expect(parseOzan(feed)).toEqual({ USD: 50.935, GBP: 66.775, CHF: 60.547, JPY: 0.3217 });
  });

  it("altın: gram, has ve yeni ziynet; tanınmayan satırlar atlanır", () => {
    const gold = {
      data: {
        ALTIN: { code: "Has Altın", alis: "6,027.25", satis: "6,077.25" },
        "995HAS": { code: "995 Has (24 Ayar)", alis: "5,997.10", satis: "6,046.85" },
        gram13: { code: "1 GR 24 AYAR", alis: "6,028", satis: "6,108" },
        gram14: { code: "5 GR 24 AYAR", alis: "30,056", satis: "30,416" },
        stl1: { code: "Y.Çeyrek   / ₺", alis: "9,813", satis: "9,990" },
        stl3: { code: "Y.Yarım  / ₺", alis: "19,639", satis: "19,962" },
        stl5: { code: "Y.Teklik   / ₺", alis: "39,153", satis: "39,784" },
        stl7: { code: "Y.Gremse   / ₺", alis: "97,050", satis: "99,036" },
        stl9: { code: "Y.Atalira   / ₺", alis: "40,129", satis: "40,840" },
        stl11: { code: "Y.AtaBeşli   / ₺", alis: "200,517", satis: "203,628" },
      },
    };
    expect(parseOzan(gold)).toEqual({
      HAS: 6046.85,
      GAU: 6108,
      CEYREK: 9990,
      YARIM: 19962,
      TAM: 39784,
      GREMSE: 99036,
      CUMHURIYET: 40840,
      ATA5: 203628,
    });
  });

  it("bozuk yanıt boş döner", () => {
    expect(parseOzan(null)).toEqual({});
    expect(parseOzan({ hata: 1 })).toEqual({});
    expect(parseOzan({ data: { x: null, y: { code: "USD/TL", satis: "—" } } })).toEqual({});
  });
});
