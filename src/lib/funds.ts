// Fon getiri takibi: fon başına yatırılan tutar ve günlük girilen değerler (kuruş).
// Saf hesaplar; istemci ve sunucu ortak.

export type Fund = { id: string; name: string; code: string | null; invested: number; sort: number };
export type FundValue = { fundId: string; day: string; value: number };

export type FundStat = {
  fund: Fund;
  /** Son girilen değer ve günü (değer yoksa null) */
  value: number | null;
  day: string | null;
  /** Bir önceki girişe göre değişim (önceki giriş yoksa null) */
  daily: number | null;
  dailyPct: number | null;
  prevDay: string | null;
  /** Yatırılana göre toplam getiri */
  total: number | null;
  totalPct: number | null;
  /** Stopaj sonrası net getiri (toplam × 0,825; zararda toplamla aynı) */
  net: number | null;
  netPct: number | null;
  /** Eskiden yeniye değer geçmişi (grafik) */
  history: { day: string; value: number }[];
};

const pct = (diff: number, base: number) => (base > 0 ? diff / base : null);

/** Stopaj sonrası oran: net getiri = toplam getiri × 0,825 (%17,5 stopaj). */
export const NET_RATE = 0.825;

/** Net getiri: kazançta stopaj düşülür; zararda stopaj olmadığından toplam getiriyle aynıdır. */
export const netReturn = (total: number) => (total > 0 ? Math.round(total * NET_RATE) : total);

export function fundStats(funds: Fund[], values: FundValue[]): FundStat[] {
  return funds.map((fund) => {
    const history = values
      .filter((v) => v.fundId === fund.id)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((v) => ({ day: v.day, value: v.value }));
    const last = history.at(-1) ?? null;
    const prev = history.at(-2) ?? null;
    const daily = last && prev ? last.value - prev.value : null;
    const total = last ? last.value - fund.invested : null;
    return {
      fund,
      value: last?.value ?? null,
      day: last?.day ?? null,
      daily,
      dailyPct: daily !== null && prev ? pct(daily, prev.value) : null,
      prevDay: prev?.day ?? null,
      total,
      totalPct: total !== null ? pct(total, fund.invested) : null,
      net: total !== null ? netReturn(total) : null,
      netPct: total !== null ? pct(netReturn(total), fund.invested) : null,
      history,
    };
  });
}

/** Tüm fonların toplamı (değeri girilmiş fonlar). */
export function fundTotals(stats: FundStat[]) {
  const withValue = stats.filter((s) => s.value !== null);
  const value = withValue.reduce((s, f) => s + f.value!, 0);
  const invested = withValue.reduce((s, f) => s + f.fund.invested, 0);
  const withDaily = withValue.filter((s) => s.daily !== null);
  const daily = withDaily.reduce((s, f) => s + f.daily!, 0);
  const prevBase = withDaily.reduce((s, f) => s + (f.value! - f.daily!), 0);
  const total = value - invested;
  // Stopaj her fonun kendi kazancından kesilir: bir fonun zararı diğerinin vergisini düşürmez.
  const net = withValue.reduce((s, f) => s + (f.net ?? 0), 0);
  return {
    value,
    invested,
    daily: withDaily.length ? daily : null,
    dailyPct: withDaily.length ? pct(daily, prevBase) : null,
    total,
    totalPct: pct(total, invested),
    net,
    netPct: pct(net, invested),
  };
}
