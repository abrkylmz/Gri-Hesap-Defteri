import { NextResponse } from "next/server";
import { ALTINKAYNAK_GOLD_URL, parseAltinkaynak } from "@/lib/gold-feed";
import { db } from "@/lib/db";

// GEÇİCİ: sunucudan Altınkaynak'a erişimi ve kayıtlı gümüş kurunu kontrol etmek için (yalnız açık fiyatlar).
export const dynamic = "force-dynamic";

export async function GET() {
  let feed: unknown = null;
  let status = 0;
  try {
    const res = await fetch(`${ALTINKAYNAK_GOLD_URL}?t=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    status = res.status;
    feed = parseAltinkaynak(await res.json());
  } catch (e) {
    feed = String(e);
  }
  const stored = await db()`select code, day::text, rate::float8 as rate, fetched_at::text from fx_rates
    where code in ('XAG', 'GAU') order by day desc limit 4`;
  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, status, feed, stored });
}
