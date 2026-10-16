import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { exportBackup, parseBackup, restoreBackup } from "@/lib/backup";
import { allow } from "@/lib/rate-limit";

// Tam yedek: GET → JSON dosyası indirir, POST → dosyayı hesaba geri yükler (mevcut verilere ekler).
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024;

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Oturum yok" }, { status: 401 });
  if (!(await allow("backup", user.userId))) {
    return NextResponse.json({ error: "Çok sık denendi. Biraz sonra tekrar dene." }, { status: 429 });
  }
  const backup = await exportBackup(user.userId, user.username);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(backup), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gri-yedek-${user.username}-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Oturumunun süresi dolmuş. Yeniden giriş yap." }, { status: 401 });
  // Yalnızca aynı siteden (form/fetch); başka sitelerin göndermesine karşı.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 403 });
  }
  if (!(await allow("backup", user.userId))) {
    return NextResponse.json({ error: "Çok sık denendi. Biraz sonra tekrar dene." }, { status: 429 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return NextResponse.json({ error: "Dosya çok büyük (en fazla 4 MB)." }, { status: 413 });

  let json: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BYTES) return NextResponse.json({ error: "Dosya çok büyük (en fazla 4 MB)." }, { status: 413 });
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Dosya okunamadı; geçerli bir yedek dosyası seç." }, { status: 400 });
  }
  const backup = parseBackup(json);
  if (typeof backup === "string") return NextResponse.json({ error: backup }, { status: 400 });

  const report = await restoreBackup(user.userId, backup);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, report, from: backup.username, exportedAt: backup.exportedAt });
}
