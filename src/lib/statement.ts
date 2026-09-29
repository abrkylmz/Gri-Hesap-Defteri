// Banka ekstresi (CSV / Excel / "Excel" diye verilen HTML tablo) ayrıştırma.
// Tarayıcıdan bağımsız, saf fonksiyonlar; birim testli (statement.test.ts).

import type { CategoryRow, EntryKind } from "@/lib/types";
import { normalize } from "@/lib/ledger";
import { toMinor } from "@/lib/money";

export type Cell = string | number | boolean | Date | null;
export type Grid = Cell[][];

const pad = (n: number) => String(n).padStart(2, "0");

// ─── Metin çözme ve CSV ─────────────────────────────────────────────────

/** UTF-8 dener; geçersizse Türk bankalarında yaygın Windows-1254'e düşer. */
export function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1254").decode(buf);
  }
}

/** Ayırıcıyı (; , sekme) ilk satırlardaki tırnak dışı sayıma göre bulur ve RFC 4180'e göre ayrıştırır. */
export function parseCsv(text: string): string[][] {
  const sample = text.split(/\r?\n/).slice(0, 10);
  const count = (line: string, d: string) => {
    let n = 0;
    let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (!q && ch === d) n++;
    }
    return n;
  };
  const delimiter = [";", "\t", ","]
    .map((d) => ({ d, n: sample.reduce((s, l) => s + count(l, d), 0) }))
    .sort((a, b) => b.n - a.n)[0]!.d;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// ─── Hücre çözümleme ────────────────────────────────────────────────────

/** Tarih hücresi → "YYYY-MM-DD" (geçersizse null). */
export function parseDateCell(v: Cell): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === "number") {
    // Excel seri tarihi (1900 sistemi): 25569 = 1970-01-01
    if (v < 30000 || v > 80000) return null;
    const d = new Date(Math.round((v - 25569) * 86_400_000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T].*)?$/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else {
    match = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:\s.*)?$/);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // 31.02 gibi
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Tutar hücresi → işaretli kuruş ("-1.234,56", "(245,00)", "1.234,56 B", 1234.56). */
export function parseAmountCell(v: Cell): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v !== 0 ? Math.round(v * 100) : null;
  if (typeof v !== "string") return null;
  let s = v.trim().replace(/ /g, " ");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  // Borç (B) / alacak (A) ekleri: "1.234,56 B"
  const suffix = s.match(/\s*([BA])$/i);
  if (suffix) {
    if (suffix[1]!.toUpperCase() === "B") negative = true;
    s = s.slice(0, -suffix[0].length);
  }
  s = s.replace(/(TL|TRY|₺|USD|EUR)/gi, "").replace(/\s/g, "");
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.endsWith("-")) {
    negative = !negative;
    s = s.slice(0, -1);
  } else if (s.startsWith("+")) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;
  // "1,234.56" (İngilizce) ve "1.234,56" (Türkçe) ikisi de: toMinor çözer.
  const minor = toMinor(s);
  if (minor === null) return null;
  return negative ? -minor : minor;
}

// ─── Sütun tespiti ──────────────────────────────────────────────────────

export type Mapping = {
  headerRow: number | null;
  date: number;
  description: number;
  /** Tek tutar sütunu (işaretli) */
  amount: number | null;
  /** Ya da ayrı borç (gider) / alacak (gelir) sütunları */
  debit: number | null;
  credit: number | null;
};

const H = {
  date: /tarih|date|islem tarihi/,
  description: /aciklama|description|detay|islem|karsi taraf|alici|merchant|isyeri/,
  amount: /tutar|miktar|amount|islem tutari/,
  debit: /borc|giden|cikan|harcama|odeme|debit/,
  credit: /alacak|gelen|yatan|credit/,
  balance: /bakiye|balance|kalan/,
};

const cellText = (c: Cell) => (c instanceof Date ? "" : c === null ? "" : String(c));

/** Başlık satırını ve sütunları tahmin eder; kullanıcı ekranda düzeltebilir. */
export function detectMapping(grid: Grid): Mapping | null {
  if (grid.length === 0) return null;
  const width = Math.max(...grid.map((r) => r.length));
  const dateCols = (r: Cell[]) => r.map((c, i) => (parseDateCell(c) ? i : -1)).filter((i) => i >= 0);

  // İlk tarih içeren satır veri başlangıcıdır; bir öncesi başlıktır.
  const firstData = grid.findIndex((r) => dateCols(r).length > 0 && r.some((c) => parseAmountCell(c) !== null));
  if (firstData < 0) return null;
  const headerRow = firstData > 0 ? firstData - 1 : null;
  const header = headerRow !== null ? grid[headerRow]!.map((c) => normalize(cellText(c))) : [];
  const data = grid.slice(firstData, firstData + 50);
  const find = (re: RegExp, exclude: number[] = []) => header.findIndex((h, i) => !exclude.includes(i) && re.test(h));

  // Tarih: başlıktan ya da en çok tarih içeren sütun
  const dateCounts = Array.from({ length: width }, (_, i) => data.filter((r) => parseDateCell(r[i] ?? null)).length);
  const byHeaderDate = find(H.date);
  const date = byHeaderDate >= 0 && dateCounts[byHeaderDate]! > 0 ? byHeaderDate : dateCounts.indexOf(Math.max(...dateCounts));

  const balance = header.map((h, i) => (H.balance.test(h) ? i : -1)).filter((i) => i >= 0);
  const amountLike = Array.from({ length: width }, (_, i) => i).filter(
    (i) =>
      i !== date &&
      !balance.includes(i) &&
      data.filter((r) => parseAmountCell(r[i] ?? null) !== null).length >= Math.max(1, data.length * 0.3),
  );

  let amount: number | null = null;
  let debit: number | null = null;
  let credit: number | null = null;
  const d = find(H.debit, [date, ...balance]);
  const c = find(H.credit, [date, ...balance]);
  if (d >= 0 && c >= 0) {
    debit = d;
    credit = c;
  } else {
    const byHeader = find(H.amount, [date, ...balance]);
    amount = byHeader >= 0 ? byHeader : (amountLike[0] ?? null);
  }
  if (amount === null && (debit === null || credit === null)) return null;

  // Açıklama: başlıktan ya da en uzun ortalama metinli sütun
  const used = [date, amount, debit, credit].filter((x): x is number => x !== null);
  let description = find(H.description, used);
  if (description < 0) {
    const avg = Array.from({ length: width }, (_, i) =>
      used.includes(i) ? -1 : data.reduce((s, r) => s + cellText(r[i] ?? null).length, 0) / data.length,
    );
    description = avg.indexOf(Math.max(...avg));
  }
  return { headerRow, date, description, amount, debit, credit };
}

// ─── Kayıtlara dönüştürme ───────────────────────────────────────────────

export type ImportRow = {
  key: number;
  date: string;
  note: string;
  /** Pozitif kuruş */
  amount: number;
  kind: EntryKind;
};

/**
 * @param expenseIsNegative Tek tutar sütununda eksi = gider (banka hesabı; varsayılan).
 *   Kredi kartı ekstrelerinde çoğu zaman tersidir: artı = harcama.
 */
export function buildRows(grid: Grid, m: Mapping, expenseIsNegative = true): ImportRow[] {
  const start = m.headerRow === null ? 0 : m.headerRow + 1;
  const out: ImportRow[] = [];
  grid.slice(start).forEach((r, i) => {
    const date = parseDateCell(r[m.date] ?? null);
    if (!date) return;
    let signed: number | null = null;
    if (m.amount !== null) {
      const v = parseAmountCell(r[m.amount] ?? null);
      if (v !== null) signed = expenseIsNegative ? v : -v;
    } else {
      const debit = parseAmountCell(r[m.debit!] ?? null);
      const credit = parseAmountCell(r[m.credit!] ?? null);
      if (debit) signed = -Math.abs(debit);
      else if (credit) signed = Math.abs(credit);
    }
    if (!signed) return;
    const note = cellText(r[m.description] ?? null).replace(/\s+/g, " ").trim().slice(0, 200);
    out.push({ key: start + i, date, note, amount: Math.abs(signed), kind: signed < 0 ? "expense" : "income" });
  });
  return out;
}

// ─── Kategori önerisi ───────────────────────────────────────────────────

/** Yaygın Türk iş yerleri/kurumları → varsayılan kategori adı */
const RULES: [RegExp, string, EntryKind][] = [
  [/migros|a101|a 101|bim |\bbim\b|sok market|\bsok\b|carrefour|file market|macrocenter|metro market|hakmar|onur market/, "Market", "expense"],
  [/shell|opet|petrol ofisi|\bbp\b|total|aytemiz|akaryakit|otoyol|hgs|ogs|metro istanbul|istanbulkart|marti|bitaksi|uber/, "Ulaşım", "expense"],
  [/netflix|spotify|youtube|disney|exxen|blutv|amazon prime|apple\.com|icloud|google storage|chatgpt|openai/, "Abonelikler", "expense"],
  [/turkcell|vodafone|turk telekom|superonline|turknet|enerjisa|ck enerji|igdas|iski|aski|izsu|bogazici|dogalgaz|elektrik|su fatura/, "Faturalar", "expense"],
  [/yemeksepeti|getir|trendyol yemek|starbucks|kahve|restoran|cafe|burger|pizza|doner|lokanta/, "Yeme-İçme", "expense"],
  [/eczane|hastane|klinik|saglik|medical|dis hekimi/, "Sağlık", "expense"],
  [/zara|lcw|lc waikiki|mavi|koton|defacto|h&m|boyner|decathlon/, "Giyim", "expense"],
  [/kira|aidat/, "Kira", "expense"],
  [/maas|ucret odemesi|salary|bordro/, "Maaş", "income"],
];

export type History = { note: string; categoryId: string }[];

/** Önce geçmiş kayıtlardan (aynı açıklamanın ilk iki kelimesi), sonra kurallardan kategori önerir. */
export function suggestCategory(
  row: Pick<ImportRow, "note" | "kind">,
  categories: CategoryRow[],
  history: History,
): string | null {
  const key = (s: string) => normalize(s).split(/[^a-z0-9]+/).filter(Boolean).slice(0, 2).join(" ");
  const k = key(row.note);
  if (k) {
    const counts = new Map<string, number>();
    for (const h of history) if (key(h.note) === k) counts.set(h.categoryId, (counts.get(h.categoryId) ?? 0) + 1);
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && categories.some((c) => c.id === best[0] && c.kind === row.kind)) return best[0];
  }
  const text = ` ${normalize(row.note)} `;
  for (const [re, name, kind] of RULES) {
    if (kind !== row.kind || !re.test(text)) continue;
    const cat = categories.find((c) => c.kind === kind && normalize(c.name) === normalize(name));
    if (cat) return cat.id;
  }
  return null;
}

/** Aynı gün, aynı tutar ve türde bir kayıt zaten var mı? (tekrar içe aktarmayı önler) */
export const dupKey = (date: string, amount: number, kind: EntryKind) => `${date}|${amount}|${kind}`;

/**
 * Tek tutar sütununda işaret yönünü tahmin eder. Banka hesabında giderler eksidir;
 * kredi kartı ekstrelerinde ise harcamalar çoğu zaman artı yazılır. Tüm tutarlar artıysa
 * bunun bir kart ekstresi olduğunu varsayar (kullanıcı ekranda değiştirebilir).
 */
export function guessExpenseIsNegative(grid: Grid, m: Mapping): boolean {
  if (m.amount === null) return true;
  const start = m.headerRow === null ? 0 : m.headerRow + 1;
  const values = grid
    .slice(start)
    .filter((r) => parseDateCell(r[m.date] ?? null))
    .map((r) => parseAmountCell(r[m.amount!] ?? null))
    .filter((v): v is number => v !== null);
  return !(values.length > 0 && values.every((v) => v > 0));
}
