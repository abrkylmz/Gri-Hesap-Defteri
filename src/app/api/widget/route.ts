import { NextResponse } from "next/server";
import { allow } from "@/lib/rate-limit";
import { widgetData, widgetUser } from "@/lib/widget";

// iPhone widget'ı (Scriptable) için özet. Kimlik: "Authorization: Bearer <widget anahtarı>" (oturum çerezi değil).
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const user = token ? await widgetUser(token) : null;
  if (!user) return json({ error: "Widget anahtarı geçersiz ya da iptal edilmiş. Ayarlar'dan yenisini oluştur." }, 401);
  if (!(await allow("widget", user.id))) return json({ error: "Çok sık yenilendi; biraz sonra tekrar dener." }, 429);
  try {
    return json(await widgetData(user));
  } catch (e) {
    console.error("[widget]", e);
    return json({ error: "Veriler alınamadı." }, 500);
  }
}
