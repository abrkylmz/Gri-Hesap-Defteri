import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSET_CODES } from "@/lib/assets";
import { parseTcmb } from "@/lib/tcmb";

const XML = `<?xml version="1.0" encoding="UTF-8"?><Tarih_Date>
<Currency CrossOrder="0" Kod="USD" CurrencyCode="USD"><Unit>1</Unit><Isim>ABD DOLARI</Isim>
  <ForexBuying>48.9300</ForexBuying><ForexSelling>49.0184</ForexSelling></Currency>
<Currency CrossOrder="11" Kod="JPY" CurrencyCode="JPY"><Unit>100</Unit><Isim>JAPON YENİ</Isim>
  <ForexBuying>31.0</ForexBuying><ForexSelling>31.3013</ForexSelling></Currency>
<Currency CrossOrder="12" Kod="IRR" CurrencyCode="IRR"><Unit>100</Unit><Isim>İRAN RİYALİ</Isim>
  <ForexBuying></ForexBuying><ForexSelling></ForexSelling></Currency>
<Currency CrossOrder="13" Kod="CHF" CurrencyCode="CHF"><Unit>1</Unit><Isim>İSVİÇRE FRANGI</Isim>
  <ForexBuying>58.5</ForexBuying><ForexSelling>58.9396</ForexSelling></Currency>
</Tarih_Date>`;

describe("TCMB kurları", () => {
  it("1 birim için satış kuru; yen 100'e bölünür", () => {
    const r = parseTcmb(XML, ["USD", "JPY", "CHF", "EUR"]);
    expect(r.USD).toBe(49.0184);
    expect(r.JPY).toBeCloseTo(0.313013, 6);
    expect(r.CHF).toBe(58.9396);
    expect(r.EUR).toBeUndefined(); // listede yok
  });
  it("boş kur komşu bloktan alınmaz", () => {
    // IRR'nin kuru boş: bir sonraki (CHF) bloğundaki kur ona yazılmamalı.
    const xml = XML.replace('CurrencyCode="IRR"', 'CurrencyCode="SEK"');
    expect(parseTcmb(xml, ["SEK"]).SEK).toBeUndefined();
  });
});

describe("veritabanı ile uyum", () => {
  it("birikim kısıtındaki varlık kodları uygulamadakilerle aynı", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const last = [...schema.matchAll(/holdings_asset_check check \(asset in \(([\s\S]*?)\)\)/g)].at(-1)?.[1] ?? "";
    const codes = [...last.matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]);
    expect(codes.sort()).toEqual([...ASSET_CODES].sort());
  });
});
