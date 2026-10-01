import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db";
import { combineCryptoPrices, parseCoinbaseRates, parseOkxTickers, type CryptoPrice } from "@/lib/crypto";

// Kaynaklar (anahtar gerektirmez; ikisi de tek istekte yüzlerce parite döner):
// - OKX spot USDT pariteleri: USDT fiyatı ve 24 saatlik değişim (ör. PI/USDT)
// - Coinbase TL kurları: OKX'te olmayan coinlerin TL fiyatı ve USDT/TL kuru
const OKX_URL = "https://www.okx.com/api/v5/market/tickers?instType=SPOT";
const COINBASE_URL = "https://api.coinbase.com/v2/exchange-rates?currency=TRY";
/** Bu süreden eski fiyatlar tazelenir ("anlık" görünüm 30 sn'de bir sorar) */
export const CRYPTO_STALE_MS = 25 * 1000;
const TIMEOUT_MS = 6000;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function refresh(symbols: string[]) {
  const [okxJson, cbJson] = await Promise.all([
    getJson(OKX_URL).catch((e) => (console.error("[kripto] okx", e), null)),
    getJson(COINBASE_URL).catch((e) => (console.error("[kripto] coinbase", e), null)),
  ]);
  const coinbaseTry = cbJson ? parseCoinbaseRates(cbJson, [...symbols, "USDT"]) : {};
  // USDT/TL: Coinbase'den; yoksa TCMB dolar kuru (USDT ≈ USD)
  let usdtTry = coinbaseTry.USDT ?? null;
  if (!usdtTry) {
    const [usd] = (await db()`select rate::float8 as rate from fx_rates where code = 'USD' order by day desc limit 1`) as {
      rate: number;
    }[];
    usdtTry = usd?.rate ?? null;
  }
  const found = combineCryptoPrices(symbols, coinbaseTry, okxJson ? parseOkxTickers(okxJson, symbols) : {}, usdtTry);
  const keys = Object.keys(found);
  if (keys.length === 0) return;
  await db()`insert into crypto_prices (symbol, price, usdt, change, fetched_at)
    select t.s, t.p, t.u, t.c, now()
      from unnest(${keys}::text[], ${keys.map((k) => found[k]!.price)}::float8[],
                  ${keys.map((k) => found[k]!.usdt)}::float8[], ${keys.map((k) => found[k]!.change)}::float8[]) as t(s, p, u, c)
    on conflict (symbol) do update
      set price = excluded.price, usdt = excluded.usdt, change = excluded.change, fetched_at = now()`;
}

/**
 * İstenen sembollerin fiyatları (önbellekten). Fiyatı hiç olmayan sembol varsa ya da `wait` isteniyorsa
 * eskimiş fiyatlar beklenerek tazelenir; aksi halde yanıttan SONRA arka planda. Kaynak çökerse eldeki kalır.
 */
export async function getCryptoPrices(
  symbols: string[],
  { wait = false }: { wait?: boolean } = {},
): Promise<Record<string, CryptoPrice>> {
  const wanted = [...new Set(symbols)];
  if (wanted.length === 0) return {};
  const read = async () =>
    (await db()`select symbol, price, usdt, change, (extract(epoch from fetched_at) * 1000)::float8 as ms
                  from crypto_prices where symbol = any(${wanted})`) as {
      symbol: string;
      price: number;
      usdt: number | null;
      change: number | null;
      ms: number;
    }[];

  let rows = await read();
  const missing = wanted.some((s) => !rows.some((r) => r.symbol === s));
  const stale = rows.some((r) => Date.now() - r.ms > CRYPTO_STALE_MS);
  if (missing || (wait && stale)) {
    try {
      await refresh(wanted);
      rows = await read();
    } catch (e) {
      console.error("[kripto] fiyat", e);
    }
  } else if (stale) {
    after(() => refresh(wanted).catch((e) => console.error("[kripto] tazeleme", e)));
  }
  return Object.fromEntries(
    rows.map((r) => [r.symbol, { price: r.price, usdt: r.usdt, change: r.change, updatedMs: r.ms }]),
  );
}
