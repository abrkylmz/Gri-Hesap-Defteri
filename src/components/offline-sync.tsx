"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { saveTransaction } from "@/lib/actions/entries";
import { readOutbox, removeFromOutbox, subscribeOutbox, type OutboxItem } from "@/lib/outbox";
import { useApp } from "@/components/app-context";
import { useToast } from "@/components/toast";

/** Sayfa önbelleğinin adı (public/sw.js ile aynı). Çıkışta silinir. */
export const PAGE_CACHE = "gri-pages-v1";

/** Çıkış yaparken: bu cihazda önbelleğe alınmış sayfaları (kişisel veri) sil. */
export function clearOfflinePages() {
  if ("caches" in window) caches.delete(PAGE_CACHE).catch(() => {});
}

const RETRY_MS = 30_000;

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * Çevrimdışı çalışma:
 * - Service worker'ı kaydeder (uygulama internetsiz de açılabilsin).
 * - Kuyruktaki kayıtları bağlantı gelince, uygulamaya dönünce ve belirli aralıklarla gönderir.
 * - Çevrimdışıyken ya da bekleyen kayıt varken sayfanın tepesinde küçük bir şerit gösterir.
 */
export function OfflineSync() {
  const { username, ledger } = useApp();
  const toast = useToast();
  const router = useRouter();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  // Anlık görüntü olarak ham metin: değişmedikçe aynı değer (gereksiz yeniden çizim olmaz).
  const raw = useSyncExternalStore(
    subscribeOutbox,
    () => {
      try {
        return localStorage.getItem(`gri:outbox:${username}`);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const pending = useMemo<OutboxItem[]>(
    () => (raw ? readOutbox(username).filter((i) => i.ledger === ledger.ownerId) : []),
    // raw değişince yeniden oku
    [raw, username, ledger.ownerId],
  );
  const [sending, setSending] = useState(false);
  const busy = useRef(false);

  const flush = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    const queue = readOutbox(username).filter((i) => i.ledger === ledger.ownerId);
    if (queue.length === 0) return;
    busy.current = true;
    setSending(true);
    let saved = 0;
    try {
      for (const item of queue) {
        let res;
        try {
          res = await saveTransaction(item.input);
        } catch {
          // Ağ koptu ya da sunucu geçici olarak hata verdi: kayıt silinmez, sonra tekrar denenir.
          break;
        }
        // Oturum düştüyse kayıtlar silinmez; yeniden giriş yapılınca gönderilir.
        if (!res.ok && /oturum/i.test(res.error)) break;
        removeFromOutbox(username, item.key);
        if (res.ok) saved++;
        else toast(`Çevrimdışı girilen bir kayıt eklenemedi: ${res.error}`, "error");
      }
    } finally {
      busy.current = false;
      setSending(false);
    }
    if (saved > 0) {
      toast(saved === 1 ? "Çevrimdışı girilen kayıt deftere yazıldı" : `Çevrimdışı girilen ${saved} kayıt deftere yazıldı`);
      router.refresh();
    }
  }, [username, ledger.ownerId, toast, router]);

  // Service worker (üretimde; geliştirmede sıcak yeniden yüklemeye karışmasın)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  // Bağlantı gelince / uygulamaya dönünce / kuyruk doluyken belirli aralıklarla gönder.
  useEffect(() => {
    if (!online || pending.length === 0) return;
    const t = setTimeout(() => void flush(), 0);
    return () => clearTimeout(t);
  }, [online, pending.length, flush]);
  useEffect(() => {
    if (pending.length === 0) return;
    const onVisible = () => document.visibilityState === "visible" && void flush();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => void flush(), RETRY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [pending.length, flush]);

  if (online && pending.length === 0) return null;

  const n = pending.length;
  const text = !online
    ? n > 0
      ? `Çevrimdışısın · ${n} kayıt bağlantı gelince deftere yazılacak`
      : "Çevrimdışısın · yeni kayıtlar bu cihazda saklanıp sonra gönderilir"
    : sending
      ? `${n} kayıt gönderiliyor…`
      : `${n} kayıt gönderilmeyi bekliyor`;

  return (
    <div className="mx-auto max-w-6xl px-5 pt-3 lg:px-10 lg:pt-6">
      <div
        role="status"
        className="rise flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-ink-2"
      >
        {online ? (
          <RefreshCw size={16} className={sending ? "shrink-0 animate-spin" : "shrink-0"} />
        ) : (
          <CloudOff size={16} className="shrink-0" />
        )}
        <span className="min-w-0 flex-1">{text}</span>
        {online && !sending && (
          <button type="button" onClick={() => void flush()} className="btn btn-ghost h-8 shrink-0 px-3 text-xs">
            Şimdi gönder
          </button>
        )}
      </div>
    </div>
  );
}
