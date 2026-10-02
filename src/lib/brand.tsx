// Marka işareti: üst üste binen üç sayfa ve yeşil kayıt satırı. İkon üretiminde (next/og) kullanılır.
// Arayüzdeki logo için components/brand-logo.tsx.
const BG = "#F6F6F7";
const ACCENT = "#9DDB24";

export function BrandMark({
  size,
  padding = 0.2,
  simple = false,
}: {
  size: number;
  padding?: number;
  /** Küçük boyutlar (sekme simgesi): çizgisiz, üst sayfa yeşil */
  simple?: boolean;
}) {
  const inner = size * (1 - padding * 2);
  return (
    <div
      style={{
        width: size,
        height: size,
        background: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={inner} height={(inner * 88) / 96} viewBox="12 16 96 88">
        <path d="M60 56L104 78L60 100L16 78Z" fill="#2B2D31" />
        <path d="M60 38L104 60L60 82L16 60Z" fill="#8A8D93" />
        <path d="M60 20L104 42L60 64L16 42Z" fill={simple ? ACCENT : "#D5D7DA"} />
        {!simple && <path d="M44 34L72 48" stroke={ACCENT} strokeWidth={7} strokeLinecap="round" />}
      </svg>
    </div>
  );
}
