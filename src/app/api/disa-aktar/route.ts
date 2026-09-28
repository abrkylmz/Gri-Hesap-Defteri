import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CategoryRow, TransactionRow } from "@/lib/database.types";

const PAGE = 1000;

/** CSV hücresi: ayırıcı/tırnak/satır sonu içeriyorsa tırnakla; formül enjeksiyonuna karşı koru. */
function cell(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const amount = (minor: number) => {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
};

export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { data: categories, error: catError } = await supabase.from("categories").select("*");
  if (catError) return NextResponse.json({ error: "Dışa aktarılamadı" }, { status: 500 });
  const byId = new Map((categories as CategoryRow[]).map((c) => [c.id, c]));

  const rows: TransactionRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("occurred_on", { ascending: true })
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) return NextResponse.json({ error: "Dışa aktarılamadı" }, { status: 500 });
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  // Türkçe Excel ";" ayırıcı ve "," ondalık bekler; BOM, UTF-8 karakterlerin doğru görünmesini sağlar.
  const lines = [
    ["Tarih", "Tür", "Kategori", "Açıklama", "Tutar", "Düzenli"].join(";"),
    ...rows.map((t) =>
      [
        t.occurred_on,
        t.kind === "income" ? "Gelir" : "Gider",
        cell(t.category_id ? (byId.get(t.category_id)?.name ?? "") : "Kategorisiz"),
        cell(t.note ?? ""),
        amount(t.kind === "income" ? t.amount : -t.amount),
        t.recurring_id ? "Evet" : "",
      ].join(";"),
    ),
  ];

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gri-hesap-defteri-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
