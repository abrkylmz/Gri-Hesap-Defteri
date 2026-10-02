// Gri Hesap Defteri logosu: üst üste binen üç sayfa ve vurgulu kayıt satırı.
// Renkler globals.css'teki --logo-* değişkenlerinden gelir (açık/koyu temaya kendiliğinden uyar);
// vurgu, seçili stilin yeşili (--income-fill). Sunucu ve istemci bileşenlerinde kullanılabilir.

const MARK_VIEWBOX = [12, 16, 96, 88] as const;
// Paketteki 620 genişliğin sağı boş; yazı ~490 birimde biter.
const FULL_VIEWBOX = [0, 0, 500, 120] as const;

function Mark() {
  return (
    <>
      <path d="M60 56L104 78L60 100L16 78Z" style={{ fill: "var(--logo-bot)" }} />
      <path d="M60 38L104 60L60 82L16 60Z" style={{ fill: "var(--logo-mid)" }} />
      <path d="M60 20L104 42L60 64L16 42Z" style={{ fill: "var(--logo-top)" }} />
      <path d="M38 37L66 51" style={{ stroke: "var(--logo-line)" }} strokeWidth={5} strokeLinecap="round" />
      <path d="M50 31L78 45" style={{ stroke: "var(--income-fill)" }} strokeWidth={5} strokeLinecap="round" />
    </>
  );
}

export function BrandLogo({
  withWordmark = true,
  height = 28,
  className,
}: {
  /** false ise yalnızca katman simgesi */
  withWordmark?: boolean;
  /** Piksel yükseklik; genişlik orana göre */
  height?: number;
  className?: string;
}) {
  const [x, y, w, h] = withWordmark ? FULL_VIEWBOX : MARK_VIEWBOX;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${x} ${y} ${w} ${h}`}
      height={height}
      width={(height * w) / h}
      role="img"
      aria-label="Gri Hesap Defteri"
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      {withWordmark ? (
        <>
          <g transform="translate(-6 -8) scale(1.17)">
            <Mark />
          </g>
          <text
            x={132}
            y={74}
            fontSize={44}
            fontWeight={300}
            letterSpacing={-1.5}
            style={{ fill: "var(--logo-sub)", fontFamily: "var(--font-sora), 'Helvetica Neue', Arial, sans-serif" }}
          >
            <tspan fontWeight={600} style={{ fill: "var(--logo-text)" }}>
              Gri
            </tspan>{" "}
            Hesap Defteri
          </text>
        </>
      ) : (
        <Mark />
      )}
    </svg>
  );
}
