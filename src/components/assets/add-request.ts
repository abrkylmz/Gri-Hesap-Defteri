"use client";

import { useEffect, useRef } from "react";

/** Varlıklar sayfasındaki "Ekle" menüsünden kartlara gönderilen ekleme isteği */
export type AddKind = "cash" | "limit" | "fx" | "crypto";
const EVENT = "gri:varlik-ekle";

export const requestAdd = (kind: AddKind) => window.dispatchEvent(new CustomEvent<AddKind>(EVENT, { detail: kind }));

/** Bu türde ekleme istenince `handler` çalışır (kartın kendi ekleme penceresi açılır). */
export function useAddRequest(kind: AddKind, handler: () => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    const onRequest = (e: Event) => (e as CustomEvent<AddKind>).detail === kind && latest.current();
    window.addEventListener(EVENT, onRequest);
    return () => window.removeEventListener(EVENT, onRequest);
  }, [kind]);
}
