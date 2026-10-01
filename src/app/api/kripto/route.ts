import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { CRYPTO_SYMBOL_RE } from "@/lib/crypto";
import { getCryptoPrices } from "@/lib/crypto-prices";
import { allow } from "@/lib/rate-limit";

// Varlıklar sayfasındaki kripto kartının "anlık" fiyat sorgusu: ?s=PI,BTC (en fazla 100 sembol).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (!(await allow("crypto", user.userId))) return NextResponse.json({ error: "Çok sık" }, { status: 429 });
  const symbols = (new URL(request.url).searchParams.get("s") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => CRYPTO_SYMBOL_RE.test(s))
    .slice(0, 100);
  const prices = await getCryptoPrices(symbols, { wait: true }).catch(() => ({}));
  return NextResponse.json({ prices }, { headers: { "Cache-Control": "no-store" } });
}
