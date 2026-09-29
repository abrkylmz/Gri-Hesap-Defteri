"use client";

import { Bell, BellOff, Send } from "lucide-react";
import { PUSH_HINT, usePush } from "@/components/use-push";
import { Spinner } from "@/components/ui";

export function PushSettings({ publicKey }: { publicKey: string | null }) {
  const { status, pending, enable, disable, test } = usePush(publicKey);
  const hint = status === "off" ? "Yaklaşan ödemeler için her sabah 09:00'da bu cihaza bildirim gönderilir." : PUSH_HINT[status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 max-w-sm">
        <p className="font-medium">Ödeme hatırlatmaları</p>
        <p className="mt-0.5 text-xs text-ink-3">{hint}</p>
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
