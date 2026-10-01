// Kripto varlıklar: istemci ve sunucu ortak tanımlar ve hesaplar (sunucuya özel kod içermez).

export type CryptoHolding = {
  id: string;
  /** Büyük harf sembol, ör. "BTC" */
  symbol: string;
  name: string | null;
  amount: number;
  /** Elle girilen birim fiyat (TL); varsa otomatik fiyatın yerine kullanılır */
  manual_price: number | null;
  /** Toplam alış maliyeti (kuruş), girildiyse */
  cost: number | null;
};

/** Otomatik fiyat: 1 birim = ? TL, USDT karşılığı, 24 saatlik değişim ve güncellenme zamanı */
export type CryptoPrice = { price: number; usdt: number | null; change: number | null; updatedMs: number };

/** Sık kullanılan coinler (ekleme ekranında hızlı seçim) */
export const POPULAR_CRYPTO: { symbol: string; name: string }[] = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "PI", name: "Pi Network" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "USDT", name: "Tether" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "XRP", name: "XRP" },
  { symbol: "BNB", name: "BNB" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "AVAX", name: "Avalanche" },
  { symbol: "PEPE", name: "Pepe" },
];

export const CRYPTO_SYMBOL_RE = /^[A-Z0-9]{2,12}$/;
export const normalizeSymbol = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Miktar metnini sayıya çevirir (en fazla 10 ondalık; kripto çok küçük birimlerle tutulur):
 * "0,0153" → 0.0153 · "1.500.000" → 1500000 · "1.500,5" → 1500.5 · "0.25" → 0.25. Geçersizse null.
 */
export function parseCryptoAmount(input: string): number | null {
  const s = input.replace(/\s/g, "");
  if (!s) return null;
  let normalized: string;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, "");
  else normalized = s;
  if (!/^\d+(\.\d{1,10})?$/.test(normalized)) return null;
  const n = Number(normalized);
  return n > 0 && n < 1e15 ? n : null;
}

/** Birim fiyat: önce elle girilen, yoksa otomatik; ikisi de yoksa null. */
export const unitPrice = (h: CryptoHolding, prices: Record<string, CryptoPrice>) =>
  h.manual_price ?? prices[h.symbol]?.price ?? null;

/** Varlığın TL değeri (kuruş); fiyat yoksa null. */
export function cryptoValue(h: CryptoHolding, prices: Record<string, CryptoPrice>): number | null {
  const p = unitPrice(h, prices);
  return p === null ? null : Math.round(h.amount * p * 100);
}

/** Küçük fiyatlar için yeterli hassasiyetle: 4.093.631,51 · 72,73 · 0,00024412 */
export function priceText(price: number): string {
  const digits = price >= 1 ? 2 : Math.min(10, Math.max(2, 2 - Math.floor(Math.log10(price)) + 2));
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: digits }).format(price);
}

/** Coinbase "exchange-rates?currency=TRY" yanıtından istenen sembollerin TL fiyatları. */
export function parseCoinbaseRates(json: unknown, symbols: readonly string[]): Record<string, number> {
  const rates = (json as { data?: { rates?: Record<string, unknown> } })?.data?.rates;
  const out: Record<string, number> = {};
  if (!rates || typeof rates !== "object") return out;
  for (const s of symbols) {
    // Oran "1 TL = x BTC" biçimindedir → 1 BTC = 1/x TL
    const x = Number(rates[s]);
    if (Number.isFinite(x) && x > 0) out[s] = 1 / x;
  }
  return out;
}

/** OKX "market/tickers?instType=SPOT" yanıtından istenen sembollerin USDT paritesi (son fiyat ve 24 saat önce). */
export function parseOkxTickers(json: unknown, symbols: readonly string[]): Record<string, { last: number; open: number | null }> {
  const data = (json as { data?: { instId?: unknown; last?: unknown; open24h?: unknown }[] })?.data;
  const out: Record<string, { last: number; open: number | null }> = {};
  if (!Array.isArray(data)) return out;
  const wanted = new Set(symbols.map((s) => `${s}-USDT`));
  for (const t of data) {
    if (typeof t?.instId !== "string" || !wanted.has(t.instId)) continue;
    const last = Number(t.last);
    const open = Number(t.open24h);
    if (Number.isFinite(last) && last > 0) {
      out[t.instId.slice(0, -5)] = { last, open: Number.isFinite(open) && open > 0 ? open : null };
    }
  }
  return out;
}

/**
 * Kaynakları birleştirir: OKX'te USDT paritesi olan coinin USDT fiyatı ve 24 saatlik değişimi oradan,
 * TL karşılığı USDT × USDT/TL kurundan; OKX'te olmayan coin Coinbase'in TL fiyatından.
 */
export function combineCryptoPrices(
  symbols: readonly string[],
  coinbaseTry: Record<string, number>,
  okx: Record<string, { last: number; open: number | null }>,
  usdtTry: number | null,
): Record<string, { price: number; usdt: number | null; change: number | null }> {
  const out: Record<string, { price: number; usdt: number | null; change: number | null }> = {};
  for (const s of symbols) {
    if (s === "USDT" && usdtTry) {
      out[s] = { price: usdtTry, usdt: 1, change: null };
    } else if (okx[s] && usdtTry) {
      const { last, open } = okx[s];
      out[s] = { price: last * usdtTry, usdt: last, change: open ? last / open - 1 : null };
    } else if (coinbaseTry[s]) {
      out[s] = { price: coinbaseTry[s], usdt: usdtTry ? coinbaseTry[s] / usdtTry : null, change: null };
    }
  }
  return out;
}
