"use client";

import { Bell, BellOff, Send } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { deletePushSubscription, savePushSubscription, sendTestPush } from "@/lib/actions/push";
import { useToast } from "@/components/toast";
import { Spinner } from "@/components/ui";

type Status = "checking" | "unconfigured" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function base64UrlToUint8Array(base64Url: string) {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

export function PushSettings() {
  const toast = useToast();
  const [status, setStatus] = useState<Status>("checking");
  const [pending, startTransition] = useTransition();

  const detect = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) return setStatus("unconfigured");
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return setStatus(isIos() && !isStandalone() ? "ios-install" : "unsupported");
    if (Notification.permission === "denied") return setStatus("denied");
    setStatus((await currentSubscription()) ? "on" : "off");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı API'leri yalnızca istemcide okunabilir
    detect();
  }, [detect]);

  const enable = () =>
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
          }));
        const res = await savePushSubscription(sub.toJSON());
        if (!res.ok) {
          toast(res.error, "error");
          return;
        }
        setStatus("on");
        toast("Bildirimler açıldı");
      } catch (e) {
        console.error(e);
        toast("Bildirimler açılamadı. Tarayıcı izinlerini kontrol et.", "error");
      }
    });

  const disable = () =>
    startTransition(async () => {
      const sub = await currentSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setStatus("off");
      toast("Bu cihazda bildirimler kapatıldı");
    });

  const test = () =>
    startTransition(async () => {
      const res = await sendTestPush();
      toast(res.ok ? "Test bildirimi gönderildi" : res.error, res.ok ? "default" : "error");
    });

  const hint: Record<Status, string> = {
    checking: "Kontrol ediliyor…",
    unconfigured: "Sunucuda bildirim anahtarları tanımlı değil (VAPID).",
    unsupported: "Bu tarayıcı bildirimleri desteklemiyor.",
    "ios-install": "iPhone'da bildirim için önce uygulamayı Ana Ekrana ekle, sonra oradan açıp bu düğmeye bas.",
    denied: "Bildirim izni reddedilmiş. Tarayıcı/telefon ayarlarından bu site için bildirimlere izin ver.",
    off: "Yaklaşan ödemeler için her sabah 09:00'da bu cihaza bildirim gönderilir.",
    on: "Bu cihaz yaklaşan ödemeler için sabah 09:00'da bildirim alıyor.",
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 max-w-sm">
        <p className="font-medium">Ödeme hatırlatmaları</p>
        <p className="mt-0.5 text-xs text-ink-3">{hint[status]}</p>
      </div>
      <div className="flex gap-2">
        {status === "on" && (
          <>
            <button type="button" className="btn btn-ghost h-10 text-sm" onClick={test} disabled={pending}>
              <Send size={15} /> Test
            </button>
            <button type="button" className="btn btn-ghost h-10 text-sm" onClick={disable} disabled={pending}>
              {pending ? <Spinner /> : <BellOff size={15} />} Kapat
            </button>
          </>
        )}
        {status === "off" && (
          <button type="button" className="btn btn-primary h-10 text-sm" onClick={enable} disabled={pending}>
            {pending ? <Spinner /> : <Bell size={15} />} Bildirimleri aç
          </button>
        )}
      </div>
    </div>
  );
}
