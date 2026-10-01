// Döviz ve altın varlık tanımları (istemci ve sunucu ortak; sunucuya özel kod içermez).

export type AssetKind = "currency" | "gold" | "silver";

export type AssetDef = {
  code: string;
  label: string;
  /** Miktarın birimi: "$", "gr", "adet" */
  unit: string;
  kind: AssetKind;
  /** Kart teması (Tailwind sınıfları) */
  theme: string;
  /** Kısa gösterim, ör. "Dolar", "Gram altın" */
  short: string;
  /** Simgede gösterilen kısa işaret (dövizlerde) */
  symbol?: string;
};

const FX_THEME = "from-teal-400 via-cyan-600 to-sky-800 text-white";
const GOLD_THEME = "from-amber-200 via-yellow-400 to-amber-600 text-amber-950";

const currency = <C extends string>(code: C, label: string, short: string, unit: string, symbol: string, theme = FX_THEME) =>
  ({ code, label, short, unit, symbol, kind: "currency", theme }) as const;
const gold = <C extends string>(code: C, label: string, short: string, unit: "gr" | "adet") =>
  ({ code, label, short, unit, kind: "gold", theme: GOLD_THEME }) as const;

export const ASSETS = [
  currency("USD", "ABD Doları", "Dolar", "$", "$", "from-emerald-400 via-emerald-600 to-emerald-800 text-white"),
  currency("EUR", "Euro", "Euro", "€", "€", "from-sky-400 via-blue-600 to-indigo-800 text-white"),
  currency("GBP", "İngiliz Sterlini", "Sterlin", "£", "£", "from-violet-400 via-purple-600 to-fuchsia-800 text-white"),
  currency("CHF", "İsviçre Frangı", "Frang", "CHF", "Fr", "from-rose-400 via-red-600 to-red-800 text-white"),
  currency("JPY", "Japon Yeni", "Yen", "¥", "¥"),
  currency("CAD", "Kanada Doları", "Kanada $", "C$", "C$"),
  currency("AUD", "Avustralya Doları", "Avustralya $", "A$", "A$"),
  currency("SAR", "Suudi Arabistan Riyali", "Riyal", "SAR", "SR"),
  currency("AED", "BAE Dirhemi", "Dirhem", "AED", "Dh"),
  currency("QAR", "Katar Riyali", "Katar riyali", "QAR", "QR"),
  currency("KWD", "Kuveyt Dinarı", "Dinar", "KWD", "KD"),
  currency("AZN", "Azerbaycan Manatı", "Manat", "₼", "₼"),
  currency("CNY", "Çin Yuanı", "Yuan", "CN¥", "¥"),
  currency("RUB", "Rus Rublesi", "Ruble", "₽", "₽"),
  currency("SEK", "İsveç Kronu", "İsveç kr.", "SEK", "kr"),
  currency("NOK", "Norveç Kronu", "Norveç kr.", "NOK", "kr"),
  currency("DKK", "Danimarka Kronu", "Danimarka kr.", "DKK", "kr"),
  gold("GAU", "Gram Altın", "Gram altın", "gr"),
  gold("HAS", "Has Altın (24 ayar)", "Has altın", "gr"),
  gold("CEYREK", "Çeyrek Altın", "Çeyrek", "adet"),
  gold("YARIM", "Yarım Altın", "Yarım", "adet"),
  gold("TAM", "Tam Altın", "Tam", "adet"),
  gold("CUMHURIYET", "Cumhuriyet Altını", "Cumhuriyet", "adet"),
  gold("RESAT", "Reşat Altın", "Reşat", "adet"),
  gold("GREMSE", "Gremse Altın", "Gremse", "adet"),
  gold("ATA5", "Ata Beşli", "Ata beşli", "adet"),
  gold("BILEZIK22", "22 Ayar Bilezik", "22 ayar", "gr"),
  gold("AYAR18", "18 Ayar Altın", "18 ayar", "gr"),
  gold("AYAR14", "14 Ayar Altın", "14 ayar", "gr"),
  {
    code: "XAG",
    label: "Gram Gümüş",
    short: "Gümüş",
    unit: "gr",
    kind: "silver",
    theme: "from-slate-100 via-slate-300 to-slate-500 text-slate-900",
  },
] as const satisfies readonly AssetDef[];

export type AssetCode = (typeof ASSETS)[number]["code"];

export const ASSET_BY_CODE = new Map<AssetCode, AssetDef & { code: AssetCode }>(
  ASSETS.map((a) => [a.code, a as AssetDef & { code: AssetCode }]),
);
export const ASSET_CODES = ASSETS.map((a) => a.code) as [AssetCode, ...AssetCode[]];
/** Ana ekranda varsayılan olarak izlenen kurlar */
export const DEFAULT_WATCH: AssetCode[] = ["USD", "EUR", "GAU", "CEYREK"];
export const MAX_WATCH = 8;

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
