import { NextResponse, type NextRequest } from "next/server";
import { missingEnv, SESSION_COOKIE } from "@/lib/config";

// Hızlı ön kontrol: çerez yoksa girişe yönlendir. Oturumun gerçekten geçerli olup
// olmadığı sayfalarda veritabanından doğrulanır (src/lib/auth.ts → requireUser).
export function proxy(request: NextRequest) {
  if (missingEnv().length > 0) {
    return NextResponse.redirect(new URL("/kurulum", request.url));
  }
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/giris", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Giriş/kurulum sayfaları, cron, service worker, statik dosyalar, ikonlar ve manifest hariç her şey.
    "/((?!giris|kurulum|api/cron|sw\\.js|_next/static|_next/image|favicon.ico|icon|apple-icon|pwa-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
