import { NextResponse, type NextRequest } from "next/server";
import { missingEnv, SESSION_COOKIE } from "@/lib/config";

/** Oturumsuz açılabilen sayfalar */
const PUBLIC_PAGE = /^\/(giris|kurulum)(\/|$)/;

/**
 * Her sayfa isteğinde:
 * 1. Kurulum eksikse kurulum sayfasına, oturum çerezi yoksa girişe yönlendirir. (Hızlı ön kontrol:
 *    oturumun gerçekten geçerli olup olmadığı sayfalarda veritabanından doğrulanır, bkz. lib/auth.ts.)
 * 2. İsteğe özel nonce'lu Content-Security-Policy ekler: yalnızca bu yanıtta nonce'u taşıyan
 *    scriptler (Next.js'in kendi scriptleri ve tema scripti) ve onların yüklediği dosyalar çalışır;
 *    sayfaya bir şekilde sızdırılan yabancı script çalışmaz.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (missingEnv().length > 0 && !pathname.startsWith("/kurulum")) {
    return NextResponse.redirect(new URL("/kurulum", request.url));
  }
  if (!PUBLIC_PAGE.test(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/giris", request.url));
  }

  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    // 'strict-dynamic': nonce'lu scriptlerin yüklediği parçalar (Next.js chunk'ları) da güvenilir.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Satır içi stil öznitelikleri (React style={…}) için; stiller script çalıştıramaz.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // upgrade-insecure-requests gerekmez: site yalnızca HTTPS (HSTS) ve tüm dosyalar aynı kaynaktan.
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // API'ler (kendi yetki kontrolleri var), service worker, statik dosyalar, ikonlar ve manifest hariç tüm sayfalar.
    "/((?!api/|sw\\.js|_next/static|_next/image|favicon.ico|icon|apple-icon|pwa-icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
