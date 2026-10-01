import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GEÇİCİ: veritabanı gecikmesini ölçmek için (veri döndürmez). Ölçümden sonra silinecek.
export const dynamic = "force-dynamic";

export async function GET() {
  const sql = db();
  const times: number[] = [];
  for (let i = 0; i < 4; i++) {
    const t = performance.now();
    await sql`select 1`;
    times.push(Math.round(performance.now() - t));
  }
  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, ms: times });
}
