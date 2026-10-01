// Para her yerde kuruş (minor unit) cinsinden tam sayı olarak tutulur.

import type { FxCode } from "@/lib/types";

export const CURRENCIES = [
  { code: "TRY", label: "Türk Lirası" },
  { code: "USD", label: "ABD Doları" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "İngiliz Sterlini" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
export const MAX_MINOR = 99_999_999_999;
export const MAX_INT_DIGITS = 9;

const cache = new Map<string, Intl.NumberFormat>();
function nf(currency: string, compact: boolean) {
  const key = `${currency}:${compact}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      ...(compact
        ? { notation: "compact", maximumFractionDigits: 1 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
    cache.set(key, f);
  }
  return f;
}

/** İşaret (−/+) ile para simgesi arasındaki dar, bölünmez boşluk (satır sonunda ayrılmaz). */
export const SIGN_GAP = " ";

export function formatMoney(
  minor: number,
  currency: string,
  { sign = false, compact = false }: { sign?: boolean; compact?: boolean } = {},
): string {
  const text = nf(currency, compact).format(Math.abs(minor) / 100);
  // İşaret ile tutar arasında dar, bölünmez boşluk: "− ₺1.250,00"
  if (minor < 0) return `−${SIGN_GAP}${text}`;
  if (sign && minor > 0) return `+${SIGN_GAP}${text}`;
  return text;
}

/** Tutarı görsel parçalarına ayırır: işaret, tam kısım, kuruş, sembol. */
export function moneyParts(minor: number, currency: string) {
  const parts = nf(currency, false).formatToParts(Math.abs(minor) / 100);
  let int = "";
  let frac = "";
  let symbol = "";
  let symbolFirst = false;
  for (const p of parts) {
    if (p.type === "integer" || p.type === "group") int += p.value;
    else if (p.type === "fraction") frac = p.value;
    else if (p.type === "currency") {
      symbol = p.value;
      symbolFirst = int === "";
    }
  }
  return { negative: minor < 0, int, frac, symbol, symbolFirst };
}

/** "1234567" → "1.234.567" */
export const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Serbest metni kuruşa çevirir: "1.250,50", "1250,5", "1250.50", "1.250" desteklenir.
 * Geçersiz, sıfır ya da üst sınırı aşan değerlerde null döner.
 */
export function toMinor(input: string): number | null {
  const s = input.replace(/[\s₺$€£]/g, "");
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let decimalSep: "," | "." | null = null;
  if (lastComma >= 0 && lastDot >= 0) decimalSep = lastComma > lastDot ? "," : ".";
  else if (lastComma >= 0) decimalSep = ",";
  else if (lastDot >= 0) decimalSep = /^\d{1,3}(\.\d{3})+$/.test(s) ? null : ".";

  let intPart = s;
  let fracPart = "";
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    intPart = s.slice(0, idx);
    fracPart = s.slice(idx + 1);
  }
  intPart = intPart.replace(/[.,]/g, "");
  if (!/^\d*$/.test(intPart) || !/^\d{0,2}$/.test(fracPart)) return null;
  if (!intPart && !fracPart) return null;
  if (intPart.replace(/^0+/, "").length > MAX_INT_DIGITS) return null;

  const minor = Number(intPart || "0") * 100 + Number(fracPart.padEnd(2, "0"));
  return minor > 0 && minor <= MAX_MINOR ? minor : null;
}

/** 125050 → "1250,5" · 125000 → "1250" */
export function minorToInput(minor: number): string {
  const int = Math.floor(minor / 100);
  const frac = minor % 100;
  if (!frac) return String(int);
  return `${int},${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

// ─── Dövizle girilen kayıtlar ───────────────────────────────────────────
export const FX_SYMBOL: Record<FxCode, string> = { USD: "$", EUR: "€", GBP: "£" };
const fxAmountFmt = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fxRateFmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 4 });
/** "$49,99" */
export const fxAmountText = (code: FxCode, amount: number) => `${FX_SYMBOL[code]}${fxAmountFmt.format(amount)}`;
