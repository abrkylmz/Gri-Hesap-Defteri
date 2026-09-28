import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand";

const VARIANTS = {
  "192": { size: 192, padding: 0.2 },
  "512": { size: 512, padding: 0.2 },
  // Android maskable: güvenli alan için daha geniş kenar boşluğu
  maskable: { size: 512, padding: 0.3 },
} as const;

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const v = VARIANTS[variant as keyof typeof VARIANTS];
  if (!v) return new Response("Not found", { status: 404 });
  return new ImageResponse(<BrandMark size={v.size} padding={v.padding} />, {
    width: v.size,
    height: v.size,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
