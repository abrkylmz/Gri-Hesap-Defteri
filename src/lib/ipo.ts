// Halka arz kâr/zarar hesapları. Tüm tutarlar kuruş (tam sayı), adetler lot.
// UI'dan bağımsız ve birim testli (ipo.test.ts).

export type IpoAccount = { id: string; name: string; sort: number };
export type Ipo = {
  id: string;
  code: string;
  name: string | null;
  offer_price: number;
  listed_on: string | null;
  current_price: number | null;
  price_updated_ms: number | null;
};
export type IpoAllocation = { id: string; ipo_id: string; account_id: string; lots: number };
export type IpoSale = {
  id: string;
  allocation_id: string;
  lots: number;
  price: number;
  commission: number;
  sold_on: string;
};

export type Stats = {
  /** Toplam maliyet: gelen lot × arz fiyatı */
  cost: number;
  lots: number;
  soldLots: number;
  remainingLots: number;
  /** Satışlardan net ele geçen (komisyon düşülmüş) */
  proceeds: number;
  /** Gerçekleşen kâr/zarar: net satış − satılan lotların maliyeti */
  realized: number;
  /** Eldeki lotların güncel değeri (fiyat girilmemişse arz fiyatından) */
  openValue: number;
  /** Açık pozisyon kâr/zararı: güncel değer − eldeki lotların maliyeti */
  unrealized: number;
  total: number;
};

export const EMPTY: Stats = {
  cost: 0,
  lots: 0,
  soldLots: 0,
  remainingLots: 0,
  proceeds: 0,
  realized: 0,
  openValue: 0,
  unrealized: 0,
  total: 0,
};

export function addStats(a: Stats, b: Stats): Stats {
  return {
    cost: a.cost + b.cost,
    lots: a.lots + b.lots,
    soldLots: a.soldLots + b.soldLots,
    remainingLots: a.remainingLots + b.remainingLots,
    proceeds: a.proceeds + b.proceeds,
    realized: a.realized + b.realized,
    openValue: a.openValue + b.openValue,
    unrealized: a.unrealized + b.unrealized,
    total: a.total + b.total,
  };
}

/** Bir hesabın bir halka arzdaki katılımının hesabı. */
export function allocationStats(alloc: IpoAllocation, ipo: Ipo, sales: IpoSale[]): Stats {
  const cost = alloc.lots * ipo.offer_price;
  let soldLots = 0;
  let proceeds = 0;
  for (const s of sales) {
    soldLots += s.lots;
    proceeds += s.lots * s.price - s.commission;
  }
  const remainingLots = alloc.lots - soldLots;
  const realized = proceeds - soldLots * ipo.offer_price;
  const openValue = remainingLots * (ipo.current_price ?? ipo.offer_price);
  const unrealized = openValue - remainingLots * ipo.offer_price;
  return {
    cost,
    lots: alloc.lots,
    soldLots,
    remainingLots,
    proceeds,
    realized,
    openValue,
    unrealized,
    total: realized + unrealized,
  };
}

/** Kâr yeşil, zarar turuncu, sıfır nötr (Tailwind sınıfı). */
export const plClass = (n: number) => (n > 0 ? "text-income" : n < 0 ? "text-expense" : "text-ink-2");

/** Getiri oranı (maliyet sıfırsa null). */
export const returnRate = (s: Stats) => (s.cost > 0 ? s.total / s.cost : null);

export type Portfolio = {
  total: Stats;
  byAccount: Map<string, Stats>;
  byIpo: Map<string, Stats>;
  /** ipoId → accountId → hesap */
  cells: Map<string, Map<string, { alloc: IpoAllocation; sales: IpoSale[]; stats: Stats }>>;
};

export function buildPortfolio(ipos: Ipo[], allocations: IpoAllocation[], sales: IpoSale[]): Portfolio {
  const ipoById = new Map(ipos.map((i) => [i.id, i]));
  const salesByAlloc = new Map<string, IpoSale[]>();
  for (const s of sales) {
    const list = salesByAlloc.get(s.allocation_id) ?? [];
    list.push(s);
    salesByAlloc.set(s.allocation_id, list);
  }

  let total = EMPTY;
  const byAccount = new Map<string, Stats>();
  const byIpo = new Map<string, Stats>();
  const cells: Portfolio["cells"] = new Map();

  for (const a of allocations) {
    const ipo = ipoById.get(a.ipo_id);
    if (!ipo) continue;
    const allocSales = (salesByAlloc.get(a.id) ?? []).sort((x, y) => x.sold_on.localeCompare(y.sold_on));
    const stats = allocationStats(a, ipo, allocSales);
    total = addStats(total, stats);
    byAccount.set(a.account_id, addStats(byAccount.get(a.account_id) ?? EMPTY, stats));
    byIpo.set(a.ipo_id, addStats(byIpo.get(a.ipo_id) ?? EMPTY, stats));
    const row = cells.get(a.ipo_id) ?? new Map();
    row.set(a.account_id, { alloc: a, sales: allocSales, stats });
    cells.set(a.ipo_id, row);
  }
  return { total, byAccount, byIpo, cells };
}

/** Hisse kodu normalizasyonu: "altny " → "ALTNY" */
export const normalizeCode = (s: string) =>
  s.trim().toLocaleUpperCase("tr-TR").replace(/İ/g, "I").replace(/[^A-Z0-9]/g, "");
