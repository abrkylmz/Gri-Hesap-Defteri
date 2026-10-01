import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, MOVABLE_KEYS, normalizeLayout } from "@/lib/home-layout";

describe("ana ekran düzeni", () => {
  it("kayıt yoksa varsayılan; eski nakit ayarı dikkate alınır", () => {
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout(null, true).hidden).toEqual([]);
  });
  it("bilinmeyen anahtarlar atılır, eksikler sona eklenir, tekrarlar silinir", () => {
    const l = normalizeLayout({ order: ["trend", "x", "hero", "trend", "cash"], hidden: ["barcode", "y", "barcode"] });
    expect(l.order.slice(0, 2)).toEqual(["trend", "hero"]);
    expect([...l.order].sort()).toEqual([...MOVABLE_KEYS].sort());
    expect(l.hidden).toEqual(["barcode"]);
  });
  it("bozuk veri güvenle varsayılana döner", () => {
    expect(normalizeLayout({ order: "hero", hidden: 5 })).toEqual({ order: [...MOVABLE_KEYS], hidden: [] });
  });
});
