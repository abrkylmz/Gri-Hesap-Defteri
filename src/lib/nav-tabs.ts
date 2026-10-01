// Mobil alt çubuk sekmeleri: kişi 2–5 sekme seçer ve sıralar. Ayarlar her zaman vardır
// (kaldırılırsa ayarlara ulaşılamazdı). İstemci + sunucu ortak.

export const NAV_TABS = [
  { key: "defter", href: "/", label: "Defter" },
  { key: "varliklar", href: "/varliklar", label: "Varlıklar" },
  { key: "odemeler", href: "/odemeler", label: "Ödemeler" },
  { key: "hedefler", href: "/hedefler", label: "Hedefler" },
  { key: "duzenli", href: "/duzenli", label: "Düzenli" },
  { key: "kredi", href: "/kredi", label: "Kredi" },
  { key: "halka-arz", href: "/halka-arz", label: "Halka Arz" },
  { key: "kategoriler", href: "/kategoriler", label: "Kategoriler" },
  { key: "ayarlar", href: "/ayarlar", label: "Ayarlar" },
] as const;

export type NavTabKey = (typeof NAV_TABS)[number]["key"];
export const NAV_TAB_KEYS = NAV_TABS.map((t) => t.key) as [NavTabKey, ...NavTabKey[]];
export const REQUIRED_TAB: NavTabKey = "ayarlar";
export const MAX_TABS = 5;
export const MIN_TABS = 2;
export const DEFAULT_TABS: NavTabKey[] = ["defter", "varliklar", "duzenli", "ayarlar"];

export const navTab = (key: NavTabKey) => NAV_TABS.find((t) => t.key === key)!;

/**
 * Kayıtlı (ya da hiç olmayan) listeyi güvenli hale getirir: bilinmeyen ve tekrar eden anahtarlar
 * atılır, en fazla 5 sekme kalır, Ayarlar yoksa sona eklenir; 2'den azsa varsayılana dönülür.
 */
export function normalizeTabs(raw: unknown): NavTabKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_TABS];
  let tabs = [...new Set(raw.filter((k): k is NavTabKey => (NAV_TAB_KEYS as readonly unknown[]).includes(k)))];
  if (!tabs.includes(REQUIRED_TAB)) tabs = [...tabs.slice(0, MAX_TABS - 1), REQUIRED_TAB];
  tabs = tabs.slice(0, MAX_TABS);
  if (!tabs.includes(REQUIRED_TAB)) tabs[MAX_TABS - 1] = REQUIRED_TAB;
  return tabs.length >= MIN_TABS ? tabs : [...DEFAULT_TABS];
}
