// Varlıklar sayfasındaki bölümlerin sırası: kişi kartları yukarı/aşağı taşır. İstemci + sunucu ortak.

export const ASSET_BLOCKS = [
  {
    key: "networth",
    label: "Net varlık",
    desc: "Varlıklar eksi borçlar ve geçmiş grafiği",
    wide: true,
  },
  {
    key: "cash",
    label: "Nakit hesaplar",
    desc: "Banka, cüzdan ve kasadaki para",
    wide: false,
  },
  {
    key: "limits",
    label: "Limitler",
    desc: "Kredi kartı ve hesap limitleri",
    wide: false,
  },
  {
    key: "crypto",
    label: "Kripto",
    desc: "Kripto varlıkların canlı değeri",
    wide: false,
  },
  {
    key: "funds",
    label: "Fonlar",
    desc: "Fon değeri ve bir önceki güne göre getiri",
    wide: false,
  },
  {
    key: "fx",
    label: "Döviz & altın",
    desc: "Toplam değer, birikimlerim ve güncel kurlar",
    wide: true,
  },
] as const;

export type AssetBlockKey = (typeof ASSET_BLOCKS)[number]["key"];
export const ASSET_BLOCK_KEYS = ASSET_BLOCKS.map((b) => b.key) as [
  AssetBlockKey,
  ...AssetBlockKey[],
];
export const DEFAULT_ASSETS_ORDER: AssetBlockKey[] = [...ASSET_BLOCK_KEYS];

export const assetBlock = (key: AssetBlockKey) =>
  ASSET_BLOCKS.find((b) => b.key === key)!;

/**
 * Kayıtlı sırayı güvenli hale getirir: bilinmeyen ve tekrar eden anahtarlar atılır; eksik kalan
 * (ör. sonradan eklenmiş) bölümler varsayılan sıradaki komşusunun hemen arkasına yerleştirilir.
 */
export function normalizeAssetsOrder(raw: unknown): AssetBlockKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_ASSETS_ORDER];
  const order = [
    ...new Set(
      raw.filter((k): k is AssetBlockKey =>
        (ASSET_BLOCK_KEYS as readonly unknown[]).includes(k),
      ),
    ),
  ];
  DEFAULT_ASSETS_ORDER.forEach((key, i) => {
    if (order.includes(key)) return;
    const prev = DEFAULT_ASSETS_ORDER.slice(0, i)
      .reverse()
      .find((k) => order.includes(k));
    order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, key);
  });
  return order;
}
