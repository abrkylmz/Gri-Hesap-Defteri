// Net varlık: nakit + döviz/altın + kripto − (kart borçları + kalan kredi taksitleri). Kuruş.
// Saf hesap; istemci ve sunucu ortak. Geçmiş kayıtları net-worth-store.ts'de.

import { valueOf, type Holding, type Rate } from "@/lib/assets";
import { cryptoValue, type CryptoHolding, type CryptoPrice } from "@/lib/crypto";
import type { CreditLimit } from "@/lib/limits";
import type { Wallet } from "@/lib/wallets";

export type NetWorthPoint = { day: string; assets: number; debts: number };

export function assetsTotal(
  wallets: Wallet[],
  holdings: Holding[],
  rates: Rate[],
  crypto: CryptoHolding[],
  prices: Record<string, CryptoPrice>,
): number {
  const rateBy = new Map(rates.map((r) => [r.code, r.rate]));
  const cash = wallets.reduce((s, w) => s + w.balance, 0);
  const fx = holdings.reduce((s, h) => {
    const r = rateBy.get(h.asset);
    return r === undefined ? s : s + valueOf(h.amount, r);
  }, 0);
  const coins = crypto.reduce((s, h) => s + (cryptoValue(h, prices) ?? 0), 0);
  return Math.max(0, cash + fx + coins);
}

/** Kart ve ek hesap borçları (girilmiş olanlar) + kalan kredi taksitleri. */
export function debtsTotal(limits: CreditLimit[], loansRemaining: number): number {
  return Math.max(0, limits.reduce((s, l) => s + (l.used ?? 0), 0) + loansRemaining);
}

/** Son noktaya göre `days` gün önceki (ya da ondan önceki en yakın) nokta ile karşılaştırma. */
export function changeSince(points: NetWorthPoint[], latest: number, days: number, today: string) {
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  const base = [...points].reverse().find((p) => p.day <= cutoff) ?? null;
  if (!base) return null;
  const from = base.assets - base.debts;
  return { from, diff: latest - from, ratio: from !== 0 ? (latest - from) / Math.abs(from) : null, day: base.day };
}
