"use client";

import { unstable_rethrow } from "next/navigation";
import { reportClientError } from "@/lib/actions/errors";
import type { AuthState } from "@/lib/actions/auth";

export const NETWORK_ERROR = "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.";

/**
 * Giriş/kayıt/kurtarma formlarındaki sunucu eylemini sarar: bağlantı kopması, zaman aşımı ya da
 * yeni sürüm yayınlandıktan sonra eski sayfadan gönderim gibi durumlarda tüm sayfa hata ekranına
 * düşmez; formda anlaşılır bir mesaj görünür ve hata Kontrol odası → Hatalar'a kaydedilir.
 * Yönlendirme (başarılı giriş) gibi Next.js'in kendi akışları olduğu gibi geçer.
 */
export function safeAuthAction(action: (prev: AuthState, fd: FormData) => Promise<AuthState>) {
  return async (prev: AuthState, fd: FormData): Promise<AuthState> => {
    try {
      return await action(prev, fd);
    } catch (e) {
      unstable_rethrow(e);
      const message = e instanceof Error ? e.message : String(e);
      reportClientError({
        message: `[giris] ${message} · ${navigator.onLine ? "çevrimiçi" : "çevrimdışı"}`.slice(0, 500),
        path: location.pathname,
      }).catch(() => {});
      // Sayfa eski bir sürümden kaldıysa (sunucu eylemi artık yok) sayfayı yenilemek yeter.
      if (/Server Action/i.test(message)) {
        location.reload();
        return prev;
      }
      return {
        error: NETWORK_ERROR,
        username: String(fd.get("username") ?? ""),
      };
    }
  };
}
