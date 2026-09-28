import { NextResponse, type NextRequest } from "next/server";
import { getAuth, missingEnv } from "@/lib/auth";

let middleware: ((request: NextRequest) => Promise<NextResponse>) | null = null;

// Oturumu yeniler; oturum yoksa korumalı sayfalardan girişe yönlendirir.
export function proxy(request: NextRequest) {
  // Yapılandırma eksikse anlamsız bir 500 yerine kurulum sayfasını göster.
  if (missingEnv().length > 0) {
    return NextResponse.redirect(new URL("/kurulum", request.url));
  }
  middleware ??= getAuth().middleware({ loginUrl: "/giris" });
  return middleware(request);
}

export const config = {
  matcher: [
    // Giriş/kurulum sayfaları, auth API'si, statik dosyalar, ikonlar ve manifest hariç her şey.
    "/((?!giris|kurulum|sifre-sifirla|sifre-yenile|api/auth|_next/static|_next/image|favicon.ico|icon|apple-icon|pwa-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
