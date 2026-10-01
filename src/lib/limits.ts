// Banka limitleri (kredi kartı, ek hesap): istemci ve sunucu ortak tanımlar ve hesaplar.

export const LIMIT_KINDS = [
  { kind: "card", label: "Kredi kartı", short: "Kart", emoji: "💳" },
  { kind: "overdraft", label: "Ek hesap (KMH)", short: "Ek hesap", emoji: "🏦" },
] as const;

export type LimitKind = (typeof LIMIT_KINDS)[number]["kind"];
export const LIMIT_KIND_CODES = LIMIT_KINDS.map((k) => k.kind) as [LimitKind, ...LimitKind[]];
export const limitKind = (kind: LimitKind) => LIMIT_KINDS.find((k) => k.kind === kind) ?? LIMIT_KINDS[0];

/** Sık kullanılan bankalar (ad girerken öneri) */
export const BANK_SUGGESTIONS = [
  "Ziraat",
  "İş Bankası",
  "Garanti BBVA",
  "Akbank",
  "Yapı Kredi",
  "VakıfBank",
  "Halkbank",
  "QNB",
  "DenizBank",
  "Enpara",
  "TEB",
  "ING",
  "Kuveyt Türk",
] as const;

export type CreditLimit = {
  id: string;
  bank: string;
  kind: LimitKind;
  /** Kartın/hesabın adı, ör. "Bonus Platinum" (isteğe bağlı) */
  name: string | null;
  /** Toplam limit (kuruş) */
  limit: number;
  /** Güncel borç / kullanılan (kuruş; girilmediyse null) */
  used: number | null;
  updated_ms: number;
};

export type BankLimits = { bank: string; total: number; items: CreditLimit[] };

export type LimitSummary = {
  total: number;
  card: number;
  overdraft: number;
  /** Borcu girilmiş kalemlerin toplam borcu */
  used: number;
  /** Borcu girilmiş kalemlerin limiti (kullanılabilir limit bunlara göre hesaplanır) */
  trackedLimit: number;
  /** Borcu girilmiş kalemlerde kalan limit (eksiye düşmez) */
  available: number;
  banks: BankLimits[];
};

/** Banka adlarını karşılaştırma anahtarı: büyük/küçük harf ve boşluk farkı yok sayılır. */
export const bankKey = (bank: string) => bank.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");

/** Toplamlar ve bankaya göre gruplar (büyük limitten küçüğe). */
export function summarizeLimits(rows: CreditLimit[]): LimitSummary {
  const groups = new Map<string, BankLimits>();
  let card = 0;
  let overdraft = 0;
  let used = 0;
  let trackedLimit = 0;
  let available = 0;
  for (const r of rows) {
    if (r.kind === "card") card += r.limit;
    else overdraft += r.limit;
    if (r.used !== null) {
      used += r.used;
      trackedLimit += r.limit;
      available += Math.max(0, r.limit - r.used);
    }
    const key = bankKey(r.bank);
    const g = groups.get(key) ?? { bank: r.bank.trim(), total: 0, items: [] };
    g.total += r.limit;
    g.items.push(r);
    groups.set(key, g);
  }
  const banks = [...groups.values()]
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => a.kind.localeCompare(b.kind) || b.limit - a.limit) }))
    .sort((a, b) => b.total - a.total || a.bank.localeCompare(b.bank, "tr"));
  return { total: card + overdraft, card, overdraft, used, trackedLimit, available, banks };
}
