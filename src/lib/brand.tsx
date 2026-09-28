// Marka işareti: bir ayın barkodu. İkon üretiminde (next/og) kullanılır.
const BARS = [0.55, 0.3, 0.8, 0.45, 1, 0.35, 0.65];
const LIME_INDEX = 4;

export function BrandMark({ size, padding = 0.2 }: { size: number; padding?: number }) {
  const inner = size * (1 - padding * 2);
  const gap = inner * 0.045;
  const barW = (inner - gap * (BARS.length - 1)) / BARS.length;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#0c0c0d",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", height: inner * 0.72, gap }}>
        {BARS.map((h, i) => (
          <div
            key={i}
            style={{
              width: barW,
              height: `${h * 100}%`,
              borderRadius: barW * 0.18,
              background: i === LIME_INDEX ? "#c3f150" : "#ecebe6",
            }}
          />
        ))}
      </div>
    </div>
  );
}
