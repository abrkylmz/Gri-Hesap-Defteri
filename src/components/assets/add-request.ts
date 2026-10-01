"use client";

import { useEffect, useRef } from "react";

/**
 * Genel "+" menüsünden sayfalardaki ekleme pencerelerine gönderilen istek. Sayfa (ya da kart)
 * isteği karşılayınca olayı "işlendi" olarak işaretler; böylece sayfa geçişinden sonra hedef
 * henüz yüklenmediyse istek kısa aralıklarla yeniden denenebilir.
 */
export type AddKind = "cash" | "limit" | "fx" | "crypto" | "recurring" | "loan" | "goal";
export const ADD_KINDS: AddKind[] = ["cash", "limit", "fx", "crypto", "recurring", "loan", "goal"];
const EVENT = "gri:ekle";

/** İsteği gönderir; bir dinleyici karşıladıysa true. */
export function requestAdd(kind: AddKind): boolean {
  const e = new CustomEvent<AddKind>(EVENT, { detail: kind, cancelable: true });
  return !window.dispatchEvent(e);
}

/** Hedef yüklenene kadar (en fazla ~3 sn) dener. */
export function requestAddWhenReady(kind: AddKind) {
  let tries = 0;
  const attempt = () => {
    if (requestAdd(kind) || ++tries > 30) return;
    setTimeout(attempt, 100);
  };
  attempt();
}

/** Bu türde ekleme istenince `handler` çalışır (sayfanın/kartın kendi ekleme penceresi açılır). */
export function useAddRequest(kind: AddKind, handler: () => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    const onRequest = (e: Event) => {
      if ((e as CustomEvent<AddKind>).detail !== kind) return;
      e.preventDefault(); // karşılandı
      latest.current();
    };
    window.addEventListener(EVENT, onRequest);
    return () => window.removeEventListener(EVENT, onRequest);
  }, [kind]);
}
