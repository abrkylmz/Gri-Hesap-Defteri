// Gri Hesap Defteri — service worker: bildirimler + çevrimdışı açılış.
//
// Önbellek stratejisi:
// - /_next/static ve uygulama ikonları: önce önbellek (dosya adları içerik özetli, değişmez).
// - Sayfalar (gezinme istekleri): önce ağ; ağ yoksa o sayfanın son görülen hali, o da yoksa
//   defterin son hali, o da yoksa küçük bir "çevrimdışısın" sayfası.
// - Sunucu eylemleri (POST), API'ler ve RSC istekleri hiç önbelleğe alınmaz.
// Çıkış yapılınca sayfa önbelleği uygulama tarafından silinir (kişisel veri cihazda kalmasın;
// ad src/components/offline-sync.tsx'teki PAGE_CACHE ile aynı olmalı).

const STATIC_CACHE = "gri-static-v1";
const PAGE_CACHE = "gri-pages-v1";
const STATIC_LIMIT = 400;
const PAGE_LIMIT = 40;
const NO_CACHE_PAGES = ["/giris", "/kurulum", "/api/"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE]);
      for (const key of await caches.keys()) if (key.startsWith("gri-") && !keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") {
    await cache.put(request, res.clone());
    trim(STATIC_CACHE, STATIC_LIMIT);
  }
  return res;
}

const OFFLINE_HTML = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Çevrimdışı · Gri</title><style>
:root{color-scheme:light dark;--bg:#e8e7e3;--ink:#161616;--ink3:#77756f}
@media (prefers-color-scheme:dark){:root{--bg:#0c0c0d;--ink:#ededeb;--ink3:#8a8984}}
body{margin:0;min-height:100dvh;display:grid;place-items:center;background:var(--bg);color:var(--ink);
font:16px/1.5 system-ui,-apple-system,sans-serif;padding:24px;box-sizing:border-box;text-align:center}
h1{font:italic 400 2.5rem/1.1 Georgia,serif;margin:0 0 .5rem}p{color:var(--ink3);margin:0 0 1.5rem}
button{font:inherit;font-weight:600;border:0;border-radius:999px;padding:.8rem 1.4rem;background:var(--ink);color:var(--bg)}
</style></head><body><main><h1>Çevrimdışısın</h1>
<p>Bu sayfa henüz bu cihazda açılmamış. Bağlantı gelince tekrar dene.</p>
<button onclick="location.reload()">Tekrar dene</button></main></body></html>`;

async function networkFirstPage(request) {
  const url = new URL(request.url);
  try {
    const res = await fetch(request);
    const cacheable =
      res.ok &&
      res.type === "basic" &&
      !res.redirected &&
      (res.headers.get("content-type") || "").includes("text/html") &&
      !NO_CACHE_PAGES.some((p) => url.pathname.startsWith(p));
    if (cacheable) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, res.clone());
      trim(PAGE_CACHE, PAGE_LIMIT);
    }
    return res;
  } catch {
    const cache = await caches.open(PAGE_CACHE);
    const hit =
      (await cache.match(request)) ||
      (await cache.match(url.origin + url.pathname)) ||
      (await cache.match(url.origin + "/"));
    if (hit) return hit;
    return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa-icon/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  // Uygulama simgesinde bekleyen ödeme sayısı (destekleyen cihazlarda).
  if (typeof data.badge === "number" && self.navigator.setAppBadge) {
    self.navigator.setAppBadge(data.badge).catch(() => {});
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Gri Hesap Defteri", {
      body: data.body || "",
      icon: "/pwa-icon/192",
      badge: "/pwa-icon/192",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          return w.focus().then((c) => ("navigate" in c ? c.navigate(url) : c));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
