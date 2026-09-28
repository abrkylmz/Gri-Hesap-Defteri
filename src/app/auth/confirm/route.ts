import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Yalnızca site içi göreli yollara izin ver (open-redirect koruması). */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

// E-posta onayı ve şifre sıfırlama bağlantıları buraya düşer.
// Hem token_hash (farklı cihazda açılsa da çalışır) hem PKCE code akışı desteklenir.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const target = request.nextUrl.clone();
  target.search = "";
  if (ok) {
    target.pathname = type === "recovery" ? "/sifre-yenile" : next;
  } else {
    target.pathname = "/giris";
    target.searchParams.set("hata", "baglanti");
  }
  return NextResponse.redirect(target);
}
