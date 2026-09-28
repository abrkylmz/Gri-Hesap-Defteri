import type { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";

let middleware: ((request: NextRequest) => Promise<NextResponse>) | null = null;

// Oturumu yeniler; oturum yoksa korumalı sayfalardan girişe yönlendirir.
export function proxy(request: NextRequest) {
  middleware ??= getAuth().middleware({ loginUrl: "/giris" });
  return middleware(request);
}

export const config = {
  matcher: [
    // Giriş sayfaları, auth API'si, statik dosyalar, ikonlar ve manifest hariç her şey.
    "/((?!giris|sifre-sifirla|sifre-yenile|api/auth|_next/static|_next/image|favicon.ico|icon|apple-icon|pwa-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
