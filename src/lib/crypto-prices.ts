import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db";
import { parseCoinbaseRates, type CryptoPrice } from "@/lib/crypto";

// Kaynak: Coinbase herkese açık kur listesi (anahtar gerektirmez; tek istekte yüzlerce para birimi).
const COINBASE_URL = "https://api.coinbase.com/v2/exchange-rates?currency=TRY";
const STALE_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 6000;

async function refresh(symbols: string[]) {
  const res = await fetch(COINBASE_URL, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`coinbase → ${res.status}`);
  const found = parseCoinbaseRates(await res.json(), symbols);
  const keys = Object.keys(found);
  if (keys.length === 0) return;
  await db()`insert into crypto_prices (symbol, price, fetched_at)
    select t.s, t.p, now() from unnest(${keys}::text[], ${keys.map((k) => found[k]!)}::float8[]) as t(s, p)
    on conflict (symbol) do update set price = excluded.price, fetched_at = now()`;
}

/**
 * İstenen sembollerin TL fiyatları (önbellekten). Hiç fiyatı olmayan sembol varsa bir kez beklenerek
 * çekilir; eskimiş fiyatlar yanıttan SONRA arka planda tazelenir. Kaynağa ulaşılamazsa eldeki kalır.
 */
export async function getCryptoPrices(symbols: string[]): Promise<Record<string, CryptoPrice>> {
  const wanted = [...new Set(symbols)];
  if (wanted.length === 0) return {};
  const read = async () =>
    (await db()`select symbol, price, (extract(epoch from fetched_at) * 1000)::float8 as ms
                  from crypto_prices where symbol = any(${wanted})`) as { symbol: string; price: number; ms: number }[];

  let rows = await read();
  const missing = wanted.filter((s) => !rows.some((r) => r.symbol === s));
  const stale = rows.some((r) => Date.now() - r.ms > STALE_MS);
  if (missing.length > 0) {
    try {
      await refresh(wanted);
      rows = await read();
    } catch (e) {
      console.error("[kripto] fiyat", e);
    }
  } else if (stale) {
    after(() => refresh(wanted).catch((e) => console.error("[kripto] tazeleme", e)));
  }
  return Object.fromEntries(rows.map((r) => [r.symbol, { price: r.price, updatedMs: r.ms }]));
}
