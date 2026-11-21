import type { AssetCode } from "@/lib/assets";

// Ozan Döviz (ozandoviz.com) canlı fiyat tablosunun beslendiği herkese açık veri adresleri.
// Döviz bürosu fiyatlarıdır; uygulamada SATIŞ fiyatı kullanılır. Resmi bir servis değildir:
// biçim değişir ya da ulaşılamazsa bu kalemler Altınkaynak / TCMB'den gelmeye devam eder.
export const OZAN_BASE = "https://www.ozandoviz.com";
export const OZAN_FEEDS = [
  "centerpagedata.php", // döviz
  "centergoldpagedata.php", // has altın
  "centergramgoldpagedata.php", // gram altın (24 ayar)
  "centersarrafiyepagedata.php", // ziynet (yeni çeyrek, yarım, teklik…)
] as const;

/**
 * Ozan'ın satır etiketi → uygulamadaki varlık. Etiketler küçük harfe çevrilip boşluklar ve
 * "/ ₺", "/tl" ekleri atılarak karşılaştırılır (ör. "Y.Çeyrek   / ₺" → "y.çeyrek").
 */
const LABELS: Record<string, AssetCode> = {
  usd: "USD",
  eur: "EUR",
  gbp: "GBP",
  chf: "CHF",
  jpy: "JPY",
  cad: "CAD",
  aud: "AUD",
  sar: "SAR",
  "1gr24ayar": "GAU",
  "995has(24ayar)": "HAS",
  "y.çeyrek": "CEYREK",
  "y.yarım": "YARIM",
  "y.teklik": "TAM",
  "y.atalira": "CUMHURIYET",
  "y.gremse": "GREMSE",
  "y.atabeşli": "ATA5",
};

const normalize = (label: string) =>
  label
    .toLocaleLowerCase("tr")
    .replace(/\s+/g, "")
    .replace(/\/(₺|tl)$/, "");

/** "6,027.25" / "50.745" / "0.3156" → sayı (virgül binlik ayırıcı, nokta ondalık); geçersizse null */
export function parseOzanPrice(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const s = value.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

type Row = { code?: unknown; satis?: unknown };

/** Bir veri adresinin yanıtından satış fiyatlarını çıkarır. Tanınmayan ya da bozuk satır atlanır. */
export function parseOzan(json: unknown): Partial<Record<AssetCode, number>> {
  const data = (json as { data?: unknown } | null)?.data;
  if (!data || typeof data !== "object") return {};
  const out: Partial<Record<AssetCode, number>> = {};
  for (const row of Object.values(data as Record<string, Row>)) {
    if (!row || typeof row.code !== "string") continue;
    const asset = LABELS[normalize(row.code)];
    const sell = parseOzanPrice(row.satis);
    if (asset && sell !== null) out[asset] = sell;
  }
  return out;
}
