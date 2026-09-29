"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { deletePushSubscription, savePushSubscription, sendTestPush } from "@/lib/actions/push";
import { useToast } from "@/components/toast";

export type PushStatus = "checking" | "unconfigured" | "unsupported" | "ios-install" | "denied" | "off" | "on";

export const PUSH_HINT: Record<PushStatus, string> = {
  checking: "Kontrol ediliyor…",
  unconfigured: "Bildirim servisine şu an ulaşılamıyor. Sayfayı yenileyip tekrar dene.",
  unsupported: "Bu tarayıcı bildirimleri desteklemiyor.",
  "ios-install": "iPhone'da bildirim için önce uygulamayı Ana Ekrana ekle (Paylaş → Ana Ekrana Ekle), sonra oradan aç.",
  denied: "Bildirim izni reddedilmiş. Telefon/tarayıcı ayarlarından bu site için bildirimlere izin ver.",
  off: "Bu cihazda bildirimler kapalı.",
  on: "Bu cihaz yaklaşan ödemeler için sabah 09:00'da bildirim alıyor.",
};

function base64UrlToUint8Array(base64Url: string) {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Bu cihazın bildirim durumu ve aç/kapat/test işlemleri (Ayarlar ve hızlı giriş ortak kullanır). */
export function usePush(publicKey: string | null) {
  const toast = useToast();
  const [status, setStatus] = useState<PushStatus>("checking");
  const [pending, startTransition] = useTransition();

  const detect = useCallback(async () => {
    if (!publicKey) return setStatus("unconfigured");
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return setStatus(isIos() && !isStandalone() ? "ios-install" : "unsupported");
    if (Notification.permission === "denied") return setStatus("denied");
    setStatus((await currentSubscription()) ? "on" : "off");
  }, [publicKey]);

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
            applicationServerKey: base64UrlToUint8Array(publicKey!),
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

  return { status, pending, enable, disable, test };
}
