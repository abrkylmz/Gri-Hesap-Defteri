// Döviz ve altın varlık tanımları (istemci ve sunucu ortak; sunucuya özel kod içermez).

export type AssetCode = "USD" | "EUR" | "GBP" | "GAU" | "CEYREK" | "YARIM" | "TAM" | "CUMHURIYET" | "XAG";
export type AssetKind = "currency" | "gold" | "silver";

export type AssetDef = {
  code: AssetCode;
  label: string;
  /** Miktarın birimi: "$", "gram", "adet" */
  unit: string;
  kind: AssetKind;
  /** Kart teması (Tailwind sınıfları) */
  theme: string;
  /** Kısa gösterim, ör. "USD", "Gram" */
  short: string;
};

export const ASSETS: AssetDef[] = [
  {
    code: "USD",
    label: "ABD Doları",
    short: "Dolar",
    unit: "$",
    kind: "currency",
    theme: "from-emerald-400 via-emerald-600 to-emerald-800 text-white",
  },
  {
    code: "EUR",
    label: "Euro",
    short: "Euro",
    unit: "€",
    kind: "currency",
    theme: "from-sky-400 via-blue-600 to-indigo-800 text-white",
  },
  {
    code: "GBP",
    label: "İngiliz Sterlini",
    short: "Sterlin",
    unit: "£",
    kind: "currency",
    theme: "from-violet-400 via-purple-600 to-fuchsia-800 text-white",
  },
  {
    code: "GAU",
    label: "Gram Altın",
    short: "Gram altın",
    unit: "gr",
    kind: "gold",
    theme: "from-amber-200 via-yellow-400 to-amber-600 text-amber-950",
  },
  {
    code: "CEYREK",
    label: "Çeyrek Altın",
    short: "Çeyrek",
    unit: "adet",
    kind: "gold",
    theme: "from-amber-200 via-yellow-400 to-amber-600 text-amber-950",
  },
  {
    code: "YARIM",
    label: "Yarım Altın",
    short: "Yarım",
    unit: "adet",
    kind: "gold",
    theme: "from-amber-200 via-yellow-400 to-amber-600 text-amber-950",
  },
  {
    code: "TAM",
    label: "Tam Altın",
    short: "Tam",
    unit: "adet",
    kind: "gold",
    theme: "from-amber-200 via-yellow-400 to-amber-600 text-amber-950",
  },
  {
    code: "CUMHURIYET",
    label: "Cumhuriyet Altını",
    short: "Cumhuriyet",
    unit: "adet",
    kind: "gold",
    theme: "from-amber-200 via-yellow-400 to-amber-600 text-amber-950",
  },
  {
    code: "XAG",
    label: "Gram Gümüş",
    short: "Gümüş",
    unit: "gr",
    kind: "silver",
    theme: "from-slate-100 via-slate-300 to-slate-500 text-slate-900",
  },
];

export const ASSET_BY_CODE = new Map(ASSETS.map((a) => [a.code, a]));
export const ASSET_CODES = ASSETS.map((a) => a.code) as [AssetCode, ...AssetCode[]];

export type Rate = {
  code: AssetCode;
  /** 1 birimin TL karşılığı */
  rate: number;
  /** Önceki güne göre değişim oranı (ör. 0.012 = %1,2); önceki gün yoksa null */
  change: number | null;
  /** Son güncelleme (ms) */
  updatedMs: number;
  /** Son günlerin kurları, eskiden yeniye (en fazla ~15 gün) */
  history?: number[];
};

export type Holding = {
  id: string;
  asset: AssetCode;
  amount: number;
  /** Toplam alış maliyeti (kuruş), girildiyse */
  cost: number | null;
  note: string | null;
};

/** Miktar × kur → kuruş */
export const valueOf = (amount: number, rate: number) => Math.round(amount * rate * 100);

/**
 * Miktar metnini sayıya çevirir (en fazla 4 ondalık):
 * "12,5" → 12.5 · "1.500" → 1500 · "1.500,25" → 1500.25 · "0.5" → 0.5. Geçersizse null.
 */
export function parseQuantity(input: string): number | null {
  const s = input.replace(/\s/g, "");
  if (!s) return null;
  let normalized: string;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, "");
  else normalized = s;
  if (!/^\d+(\.\d{1,4})?$/.test(normalized)) return null;
  const n = Number(normalized);
  return n > 0 && n < 1e9 ? n : null;
}
