import { describe, expect, it } from "vitest";
import { DEFAULT_TABS, normalizeTabs } from "./nav-tabs";

describe("normalizeTabs", () => {
  it("kayıt yoksa varsayılan", () => {
    expect(normalizeTabs(null)).toEqual(DEFAULT_TABS);
  });
  it("bilinmeyen ve tekrarları atar, Ayarlar'ı ekler", () => {
    expect(normalizeTabs(["hedefler", "x", "hedefler", "defter"])).toEqual(["hedefler", "defter", "ayarlar"]);
  });
  it("en fazla 5 sekme ve Ayarlar korunur", () => {
    const t = normalizeTabs(["defter", "varliklar", "odemeler", "hedefler", "duzenli", "kredi"]);
    expect(t).toHaveLength(5);
    expect(t).toContain("ayarlar");
  });
  it("sıra korunur (Ayarlar ortada olabilir)", () => {
    expect(normalizeTabs(["ayarlar", "defter"])).toEqual(["ayarlar", "defter"]);
  });
  it("tek sekme kalırsa varsayılana döner", () => {
    expect(normalizeTabs(["ayarlar"])).toEqual(DEFAULT_TABS);
  });
});
