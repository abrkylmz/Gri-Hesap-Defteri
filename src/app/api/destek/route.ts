import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, isSupportStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getInbox, getOwnThread, getThreadInfo, threadMessages } from "@/lib/support";

// Canlı destek ekranlarının birkaç saniyede bir yokladığı uç nokta. Ekran açıkken okundu bilgisi de güncellenir.
//   GET /api/destek            → kullanıcının kendi sohbeti
//   GET /api/destek?thread=ID  → ekip: tek sohbet
//   GET /api/destek?inbox=1    → ekip: destek kutusu
export const dynamic = "force-dynamic";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const sql = db();

  if (params.has("inbox") || params.has("thread")) {
    // Yetkisi olmayana uç noktanın varlığı da gösterilmez.
    if (!isSupportStaff(user)) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
    if (params.has("inbox")) return NextResponse.json({ threads: await getInbox() }, noStore);

    const id = z.uuid().safeParse(params.get("thread"));
    if (!id.success) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
    const info = await getThreadInfo(id.data);
    if (!info) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
    await sql`update support_threads set staff_read_at = now() where id = ${id.data}`;
    return NextResponse.json({ thread: info, messages: await threadMessages(id.data, true) }, noStore);
  }

  const own = await getOwnThread(user.userId);
  if (own.thread) await sql`update support_threads set user_read_at = now() where id = ${own.thread.id}`;
  return NextResponse.json(own, noStore);
}
