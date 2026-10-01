import { ASSETS, type AssetCode } from "@/lib/assets";

export const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

/** TCMB'den çekilen dövizler (assets.ts'deki tüm dövizler) */
export const TCMB_CODES = ASSETS.filter((a) => a.kind === "currency").map((a) => a.code) as AssetCode[];

/**
 * TCMB günlük kurlarından döviz satış kurları, 1 birim için. Bazı paralar (ör. Japon yeni)
 * 100 birim için yayımlanır; <Unit> değerine bölünür. Bulunamayan ya da kuru boş olan atlanır.
 */
export function parseTcmb(xml: string, codes: readonly AssetCode[] = TCMB_CODES): Partial<Record<AssetCode, number>> {
  const out: Partial<Record<AssetCode, number>> = {};
  for (const code of codes) {
    // Her para birimi yalnızca kendi <Currency …> bloğunda aranır (komşu bloğa taşmasın).
    const block = xml.match(new RegExp(`<Currency[^>]*CurrencyCode="${code}"[^>]*>([\\s\\S]*?)</Currency>`))?.[1];
    if (!block) continue;
    const unit = Number(block.match(/<Unit>(\d+)<\/Unit>/)?.[1] ?? 1);
    const rate = Number(block.match(/<ForexSelling>([\d.]+)<\/ForexSelling>/)?.[1]);
    if (Number.isFinite(rate) && rate > 0 && unit > 0) out[code] = rate / unit;
  }
  return out;
}
