import { describe, expect, it } from "vitest";
import { parseAltinkaynak, parseTrPrice } from "@/lib/gold-feed";

describe("Altınkaynak fiyat listesi", () => {
  it("Türkçe sayı biçimi", () => {
    expect(parseTrPrice("6.540,45")).toBe(6540.45);
    expect(parseTrPrice("105.057,44")).toBe(105057.44);
    expect(parseTrPrice("87,91")).toBe(87.91);
    expect(parseTrPrice("")).toBeNull();
    expect(parseTrPrice("0,00")).toBeNull();
    expect(parseTrPrice(12)).toBeNull();
  });

  it("alış fiyatlarını uygulamanın varlıklarına eşler", () => {
    const feed = [
      { Alis: "6.573,90", Satis: "6.623,13", Kod: "HH_T", Aciklama: "Has" },
      { Alis: "6.540,45", Satis: "6.655,33", Kod: "GA", Aciklama: "Gram Altın " },
      { Alis: "10.521,69", Satis: "11.165,00", Kod: "PC", Aciklama: "Çeyrek" },
      { Alis: "21.041,28", Satis: "22.325,00", Kod: "PY", Aciklama: "Yarım" },
      { Alis: "42.044,57", Satis: "44.645,00", Kod: "PT", Aciklama: "Teklik" },
      { Alis: "43.228,09", Satis: "46.715,00", Kod: "PA", Aciklama: "Ata Cumhuriyet" },
      { Alis: "87,91", Satis: "99,62", Kod: "AG_T", Aciklama: "Gümüş" },
    ];
    expect(parseAltinkaynak(feed)).toEqual({
      GAU: 6540.45,
      CEYREK: 10521.69,
      YARIM: 21041.28,
      TAM: 42044.57,
      CUMHURIYET: 43228.09,
      XAG: 87.91,
    });
  });

  it("bozuk ya da eksik veride yalnızca geçerli kalemler döner", () => {
    expect(parseAltinkaynak({ hata: true })).toEqual({});
    expect(parseAltinkaynak([{ Kod: "GA", Alis: "—" }, { Kod: "PC", Alis: "10.000,00" }, null])).toEqual({ CEYREK: 10000 });
  });
});
