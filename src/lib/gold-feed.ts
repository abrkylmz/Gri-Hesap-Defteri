import type { AssetCode } from "@/lib/assets";

// Altınkaynak Kuyumculuk'un sitesinde (altinkaynakkuyumculuk.com) kullanılan herkese açık fiyat listesi.
// Kuyumcu fiyatlarıdır (işçilik dahil). Birikim değerlemesinde "Alış" kullanılır: altını
// bozdurunca kuyumcunun ödediği fiyat.
export const ALTINKAYNAK_GOLD_URL = "https://static.altinkaynak.com/public/Gold";

/** Uygulamadaki varlık → Altınkaynak ürün kodu */
const CODES: Partial<Record<AssetCode, string>> = {
  GAU: "GA", // Gram Altın
  HAS: "HH_T", // Has (24 ayar, gram)
  RESAT: "PR", // Reşat
  GREMSE: "PG", // Gremse
  ATA5: "PA5", // Ata Beşli
  BILEZIK22: "PB", // 22 ayar bilezik (gram)
  AYAR18: "P18", // 18 ayar (gram)
  AYAR14: "P14", // 14 ayar (gram)
  CEYREK: "PC", // Çeyrek
  YARIM: "PY", // Yarım
  TAM: "PT", // Teklik (tam)
  CUMHURIYET: "PA", // Ata Cumhuriyet
  XAG: "AG_T", // Gümüş (gram)
};

type FeedRow = { Kod?: unknown; Alis?: unknown; Satis?: unknown };

/** "6.540,45" → 6540.45; geçersizse null */
export function parseTrPrice(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const s = value.trim().replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/** Fiyat listesinden uygulamanın altın/gümüş kurlarını çıkarır. Bulunamayan kalem eklenmez. */
export function parseAltinkaynak(json: unknown): Partial<Record<AssetCode, number>> {
  if (!Array.isArray(json)) return {};
  const byCode = new Map<string, FeedRow>();
  for (const row of json as FeedRow[]) if (row && typeof row.Kod === "string") byCode.set(row.Kod, row);
  const out: Partial<Record<AssetCode, number>> = {};
  for (const [asset, kod] of Object.entries(CODES) as [AssetCode, string][]) {
    const price = parseTrPrice(byCode.get(kod)?.Alis);
    if (price !== null) out[asset] = price;
  }
  return out;
}
