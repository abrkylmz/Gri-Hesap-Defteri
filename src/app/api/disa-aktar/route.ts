import { NextResponse } from "next/server";
import { actionScope } from "@/lib/scope";
import { db } from "@/lib/db";

type ExportRow = {
  occurred_on: string;
  kind: "income" | "expense";
  category: string | null;
  note: string | null;
  amount: number | null;
  recurring: boolean;
};

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
  // Seçili defter dışa aktarılır (paylaşılan defterde, sahibin kayıtları).
  const scope = await actionScope();
  if (!scope) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  let rows: ExportRow[];
  try {
    rows = (await db()`
      select t.occurred_on::text as occurred_on, t.kind, c.name as category, t.note,
             t.amount::float8 as amount, t.recurring_id is not null as recurring
        from transactions t
        left join categories c on c.id = t.category_id
       where t.user_id = ${scope.ownerId}
       order by t.occurred_on, t.created_at`) as ExportRow[];
  } catch (e) {
    console.error("export", e);
    return NextResponse.json({ error: "Dışa aktarılamadı" }, { status: 500 });
  }

  // Türkçe Excel ";" ayırıcı ve "," ondalık bekler; BOM, UTF-8 karakterlerin doğru görünmesini sağlar.
  const lines = [
    ["Tarih", "Tür", "Kategori", "Açıklama", "Tutar", "Düzenli"].join(";"),
    ...rows.map((t) =>
      [
        t.occurred_on,
        t.kind === "income" ? "Gelir" : "Gider",
        cell(t.category ?? "Kategorisiz"),
        cell(t.note ?? ""),
        t.amount === null ? "" : amount(t.kind === "income" ? t.amount : -t.amount),
        t.recurring ? "Evet" : "",
      ].join(";"),
    ),
  ];

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gri-${scope.ownerName}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
