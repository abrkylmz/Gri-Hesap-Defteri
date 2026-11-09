import { describe, expect, it } from "vitest";
import { DEFAULT_ASSETS_ORDER, normalizeAssetsOrder } from "./assets-layout";

describe("Varlıklar bölüm sırası", () => {
  it("kayıt yoksa varsayılan sıra", () => {
    expect(normalizeAssetsOrder(null)).toEqual(DEFAULT_ASSETS_ORDER);
  });

  it("kaydedilen sıra korunur; bilinmeyen ve tekrar edenler atılır", () => {
    expect(
      normalizeAssetsOrder([
        "funds",
        "funds",
        "x",
        "networth",
        "cash",
        "limits",
        "crypto",
        "fx",
      ]),
    ).toEqual(["funds", "networth", "cash", "limits", "crypto", "fx"]);
  });

  it("eksik bölüm varsayılan komşusunun arkasına eklenir", () => {
    expect(
      normalizeAssetsOrder(["fx", "networth", "cash", "limits", "crypto"]),
    ).toEqual(["fx", "networth", "cash", "limits", "crypto", "funds"]);
    expect(normalizeAssetsOrder(["cash"])).toEqual([
      "networth",
      "cash",
      "limits",
      "crypto",
      "funds",
      "fx",
    ]);
  });
});
