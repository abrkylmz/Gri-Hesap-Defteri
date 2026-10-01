// Ana ekran düzeni: hangi bölümler görünür ve ana sütundaki sıraları (istemci + sunucu ortak).

export const HOME_WIDGETS = [
  { key: "rates", label: "Kurlar", desc: "Döviz ve altın kur kartları", movable: false },
  { key: "cash", label: "Nakit varlıklarım", desc: "Hesaplarındaki para ve toplamı", movable: false },
  { key: "reminders", label: "Hatırlatmalar", desc: "Vadesi yaklaşan ödemeler şeridi", movable: false },
  { key: "hero", label: "Aylık net durum", desc: "Gelir, gider ve tasarruf", movable: true },
  { key: "insights", label: "Günlük özet", desc: "Günlük ortalama, ay sonu tahmini, geçen ay", movable: true },
  { key: "barcode", label: "Günlük harcama grafiği", desc: "Ayın her günü bir çizgi", movable: true },
  { key: "upcoming", label: "Yaklaşan ödemeler", desc: "Bu ayın düzenli ödemeleri", movable: true },
  { key: "breakdown", label: "Kategori dağılımı", desc: "Giderlerin kategorilere göre dağılımı", movable: true },
  { key: "trend", label: "Son 6 ay", desc: "Aylara göre gelir-gider grafiği", movable: true },
] as const;

export type WidgetKey = (typeof HOME_WIDGETS)[number]["key"];
export const WIDGET_KEYS = HOME_WIDGETS.map((w) => w.key) as [WidgetKey, ...WidgetKey[]];
/** Ana sütunda sıralanabilen bölümler, varsayılan sırayla */
export const MOVABLE_KEYS = HOME_WIDGETS.filter((w) => w.movable).map((w) => w.key) as WidgetKey[];

/** Ana ekran görünümü: standart, grafik/istatistik ağırlıklı ya da sıkı (daha çok bilgi tek ekranda) */
export const HOME_VIEWS = [
  { key: "standard", label: "Standart", desc: "Dengeli, ferah ana ekran" },
  { key: "analyst", label: "Analist", desc: "İstatistik paneli ve grafikler önde" },
  { key: "compact", label: "Kompakt", desc: "Daha çok bilgi tek ekranda" },
] as const;
export type HomeView = (typeof HOME_VIEWS)[number]["key"];
export const HOME_VIEW_KEYS = HOME_VIEWS.map((v) => v.key) as [HomeView, ...HomeView[]];

export type HomeLayout = { order: WidgetKey[]; hidden: WidgetKey[]; view: HomeView };

/** Varsayılan: standart görünüm, her şey görünür, yalnız nakit kartı kapalı (isteyen açar). */
export const DEFAULT_LAYOUT: HomeLayout = { order: [...MOVABLE_KEYS], hidden: ["cash"], view: "standard" };

const isKey = (k: unknown): k is WidgetKey => typeof k === "string" && (WIDGET_KEYS as string[]).includes(k);

/**
 * Kayıtlı (ya da hiç olmayan) düzeni güvenli hale getirir: bilinmeyen anahtarlar atılır, sıradan
 * eksik kalan bölümler sona eklenir (sonradan eklenen yeni bölümler de böylece görünür).
 * Düzen hiç kaydedilmemişse eski "nakit kartı ana ekranda" ayarı dikkate alınır.
 */
export function normalizeLayout(raw: unknown, legacyHomeCash = false): HomeLayout {
  if (!raw || typeof raw !== "object") {
    return { order: [...MOVABLE_KEYS], hidden: legacyHomeCash ? [] : ["cash"], view: "standard" };
  }
  const r = raw as { order?: unknown; hidden?: unknown; view?: unknown };
  const view = (HOME_VIEW_KEYS as string[]).includes(r.view as string) ? (r.view as HomeView) : "standard";
  const order = [...new Set((Array.isArray(r.order) ? r.order : []).filter(isKey))].filter((k) =>
    MOVABLE_KEYS.includes(k),
  );
  for (const k of MOVABLE_KEYS) if (!order.includes(k)) order.push(k);
  const hidden = [...new Set((Array.isArray(r.hidden) ? r.hidden : []).filter(isKey))];
  return { order, hidden, view };
}

export const isShown = (layout: HomeLayout, key: WidgetKey) => !layout.hidden.includes(key);
