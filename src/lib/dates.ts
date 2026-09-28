// Tarihler "YYYY-MM-DD", aylar "YYYY-MM" dizgeleri olarak taşınır. Böylece
// sunucu (UTC) ile cihaz saat dilimi arasındaki gün kaymaları ortadan kalkar.

export const DEFAULT_TZ = "Europe/Istanbul";
const LOCALE = "tr-TR";

const pad = (n: number) => String(n).padStart(2, "0");

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function todayIn(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: isValidTimeZone(tz) ? tz : DEFAULT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const isMonthKey = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export const monthOf = (date: string) => date.slice(0, 7);
export const monthStart = (month: string) => `${month}-01`;
export const dayOf = (date: string) => Number(date.slice(8, 10));

const parseMonth = (month: string): [number, number] => [
  Number(month.slice(0, 4)),
  Number(month.slice(5, 7)),
];

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

export function addMonths(month: string, n: number): string {
  const [y, m] = parseMonth(month);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = parseMonth(month);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Ayın n. günü; 31'i olmayan aylarda son güne kırpılır. */
export function dateInMonth(month: string, day: number): string {
  return `${month}-${pad(Math.min(Math.max(day, 1), daysInMonth(month)))}`;
}

export function shiftDate(date: string, days: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, opts: Intl.DateTimeFormatOptions) {
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: "UTC" });
    fmtCache.set(key, f);
  }
  return f;
}

const stripDot = (s: string) => s.replace(".", "");

export const monthName = (month: string) =>
  fmt("month", { month: "long" }).format(utc(monthStart(month)));
export const monthShort = (month: string) =>
  stripDot(fmt("monthShort", { month: "short" }).format(utc(monthStart(month))));
export const monthLabel = (month: string) =>
  fmt("monthYear", { month: "long", year: "numeric" }).format(utc(monthStart(month)));
export const weekdayName = (date: string) => fmt("weekday", { weekday: "long" }).format(utc(date));
export const weekdayShort = (date: string) =>
  stripDot(fmt("weekdayShort", { weekday: "short" }).format(utc(date)));
export const dayMonth = (date: string) =>
  fmt("dayMonth", { day: "numeric", month: "long" }).format(utc(date));
export const dayMonthShort = (date: string) =>
  stripDot(fmt("dayMonthShort", { day: "numeric", month: "short" }).format(utc(date)));
