import { NextResponse } from "next/server";
import { combineCryptoPrices, parseCoinbaseRates, parseOkxTickers } from "@/lib/crypto";

// GEÇİCİ: sunucudan OKX ve Coinbase erişimini kontrol (yalnız açık fiyatlar). Kontrolden sonra silinecek.
export const dynamic = "force-dynamic";

export async function GET() {
  const get = async (u: string) => {
    const r = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const [okx, cb] = await Promise.all([
    get("https://www.okx.com/api/v5/market/tickers?instType=SPOT").catch((e) => ({ status: 0, json: String(e) })),
    get("https://api.coinbase.com/v2/exchange-rates?currency=TRY").catch((e) => ({ status: 0, json: String(e) })),
  ]);
  const cbTry = parseCoinbaseRates(cb.json, ["USDT", "BTC"]);
  const prices = combineCryptoPrices(["PI", "BTC", "TRX"], cbTry, parseOkxTickers(okx.json, ["PI", "BTC", "TRX"]), cbTry.USDT ?? null);
  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, okx: okx.status, coinbase: cb.status, prices });
}
