import { cache } from "react";
import { after } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_TZ, todayIn } from "@/lib/dates";
import { ASSET_CODES, type AssetCode, type Rate } from "@/lib/assets";

// Kur kaynakları:
// - Döviz: TCMB günlük kurları (döviz satış), https://www.tcmb.gov.tr/kurlar/today.xml
// - Altın/gümüş: uluslararası ons fiyatı (USD) × TCMB dolar kuru → has (saf) değer.
//   Kuyumcu satış fiyatı işçilik nedeniyle biraz daha yüksek olabilir.

const TROY_OUNCE_GRAMS = 31.1034768;
const FINENESS_22K = 0.9166;
/** Her altın türündeki saf altın gramı */
const GOLD_FINE_GRAMS: Partial<Record<AssetCode, number>> = {
  GAU: 1,
  CEYREK: 1.75 * FINENESS_22K,
  YARIM: 3.5 * FINENESS_22K,
  TAM: 7.0 * FINENESS_22K,
  CUMHURIYET: 7.216 * FINENESS_22K,
};
const STALE_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 6000;

async function fetchText(url: string) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

async function fetchTcmb(): Promise<Partial<Record<"USD" | "EUR" | "GBP", number>>> {
  const xml = await fetchText("https://www.tcmb.gov.tr/kurlar/today.xml");
  const out: Partial<Record<"USD" | "EUR" | "GBP", number>> = {};
  for (const code of ["USD", "EUR", "GBP"] as const) {
    const m = xml.match(new RegExp(`CurrencyCode="${code}"[\\s\\S]*?<ForexSelling>([\\d.]+)</ForexSelling>`));
    const v = m ? Number(m[1]) : NaN;
    if (Number.isFinite(v) && v > 0) out[code] = v;
  }
  return out;
}

async function fetchOunceUsd(symbol: "XAU" | "XAG"): Promise<number | null> {
  try {
    const json = JSON.parse(await fetchText(`https://api.gold-api.com/price/${symbol}`)) as { price?: number };
    return typeof json.price === "number" && json.price > 0 ? json.price : null;
  } catch (e) {
    console.error("[fx] ons", symbol, e);
    return null;
  }
}

/** Tüm varlıkların canlı TL kurları. Bir kaynak çökerse yalnızca onun kalemleri eksik kalır. */
export async function fetchLiveRates(): Promise<Partial<Record<AssetCode, number>>> {
  const [fx, xau, xag] = await Promise.all([
    fetchTcmb().catch((e) => {
      console.error("[fx] tcmb", e);
      return {} as Partial<Record<"USD" | "EUR" | "GBP", number>>;
    }),
    fetchOunceUsd("XAU"),
    fetchOunceUsd("XAG"),
  ]);
  const rates: Partial<Record<AssetCode, number>> = { ...fx };
  const usd = fx.USD;
  if (usd && xau) {
    const gram = (xau / TROY_OUNCE_GRAMS) * usd;
    for (const [code, grams] of Object.entries(GOLD_FINE_GRAMS)) rates[code as AssetCode] = gram * grams!;
  }
  if (usd && xag) rates.XAG = (xag / TROY_OUNCE_GRAMS) * usd;
  return rates;
}

/** Kurları kaynaklardan çekip bugünün satırına yazar. Aynı anda iki tazeleme olmaz (5 dk kilit). */
async function refreshRates() {
  const sql = db();
  const claimed = await sql`insert into app_settings (key, value) values ('fx_refresh', now()::text)
    on conflict (key) do update set value = excluded.value, updated_at = now()
      where app_settings.updated_at < now() - interval '5 minutes'
    returning key`;
  if (claimed.length === 0) return;

  const live = await fetchLiveRates();
  const codes = Object.keys(live) as AssetCode[];
  if (codes.length === 0) return;
  const day = todayIn(DEFAULT_TZ);
  await sql`insert into fx_rates (code, day, rate, fetched_at)
    select t.c, ${day}::date, t.r, now() from unnest(${codes}::text[], ${codes.map((c) => live[c]!)}::numeric[]) as t(c, r)
    on conflict (code, day) do update set rate = excluded.rate, fetched_at = now()`;
}

type RateRow = { code: AssetCode; rate: number; ms: number; rn: number };

/**
 * Kurlar (önbellekten). Eskidiyse yanıttan SONRA arka planda tazelenir; hiç kur yoksa
 * (ilk kurulum) bir kez beklenerek çekilir.
 */
export const getRates = cache(async (): Promise<Rate[]> => {
  const sql = db();
  const read = async () =>
    (await sql`select code, rate::float8 as rate, (extract(epoch from fetched_at) * 1000)::float8 as ms,
                      row_number() over (partition by code order by day desc)::int as rn
                 from fx_rates where day >= current_date - 14`) as RateRow[];

  let rows = await read();
  const newest = rows.reduce((m, r) => (r.rn === 1 ? Math.max(m, r.ms) : m), 0);
  if (rows.length === 0) {
    try {
      await refreshRates();
      rows = await read();
    } catch (e) {
      console.error("[fx] ilk tazeleme", e);
    }
  } else if (Date.now() - newest > STALE_MS) {
    after(() => refreshRates().catch((e) => console.error("[fx] tazeleme", e)));
  }

  const latest = new Map<AssetCode, RateRow>();
  const previous = new Map<AssetCode, RateRow>();
  for (const r of rows) (r.rn === 1 ? latest : r.rn === 2 ? previous : null)?.set(r.code, r);

  return ASSET_CODES.flatMap((code) => {
    const cur = latest.get(code);
    if (!cur) return [];
    const prev = previous.get(code);
    return [{ code, rate: cur.rate, change: prev ? cur.rate / prev.rate - 1 : null, updatedMs: cur.ms }];
  });
});
