"use client";

import { useCallback } from "react";
import { deleteTransaction, restoreTransaction } from "@/lib/actions/entries";
import type { ActionResult } from "@/lib/action-utils";
import type { TransactionRow } from "@/lib/types";
import { useToast } from "@/components/toast";

const OFFLINE: ActionResult = { ok: false, error: "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene." };

/** Sunucu aksiyonu ağ hatasıyla reddedilirse de anlamlı bir sonuç döndürür. */
const safely = (fn: () => Promise<ActionResult>) => fn().catch(() => OFFLINE);

/** Kaydı siler ve bildirimde "Geri al" sunar. Silme başarılıysa true döner. */
export function useDeleteWithUndo() {
  const toast = useToast();
  return useCallback(
    async (tx: TransactionRow): Promise<boolean> => {
      const res = await safely(() => deleteTransaction(tx.id));
      if (!res.ok) {
        toast(res.error, "error");
        return false;
      }
      toast("Kayıt silindi", "default", {
        label: "Geri al",
        onClick: async () => {
          const r = await safely(() => restoreTransaction(tx));
          toast(r.ok ? "Kayıt geri getirildi" : r.error, r.ok ? "default" : "error");
        },
      });
      return true;
    },
    [toast],
  );
}
