"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { setSupportStatus } from "@/lib/actions/support";
import type { SupportMessage } from "@/lib/support";
import { SupportChat } from "@/components/support/chat";
import { useToast } from "@/components/toast";
import { Spinner } from "@/components/ui";

const sinceFmt = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" });

/** Ekip: tek kullanıcıyla destek sohbeti; çözüldü olarak kapatma. */
export function ThreadView({
  info,
  initial,
}: {
  info: { id: string; username: string; status: "open" | "closed"; userSinceMs: number };
  initial: SupportMessage[];
}) {
  const toast = useToast();
  const [status, setStatus] = useState(info.status);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = status === "open" ? "closed" : "open";
    start(async () => {
      const res = await setSupportStatus(info.id, next).catch(() => ({
        ok: false as const,
        error: "Bağlantı kurulamadı.",
      }));
      if (!res.ok) return toast(res.error, "error");
      setStatus(next);
      toast(next === "closed" ? "Sohbet çözüldü olarak kapatıldı" : "Sohbet yeniden açıldı");
    });
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-2xl flex-col px-5 lg:px-10">
      <header className="flex items-center gap-3 pt-4 lg:pt-10">
        <Link
          href="/destek/gelen"
          aria-label="Destek kutusuna dön"
          className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-surface-2"
        >
          <ArrowLeft size={18} />
        </Link>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold uppercase">
          {info.username.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{info.username}</span>
          <span className="block text-xs text-ink-3">
            Üye: {sinceFmt.format(info.userSinceMs)} · {status === "open" ? "açık" : "çözüldü"}
          </span>
        </span>
        <button type="button" onClick={toggle} disabled={pending} className="btn btn-ghost h-10 shrink-0 px-3 text-sm">
          {pending ? <Spinner /> : status === "open" ? <CheckCircle2 size={16} /> : <RotateCcw size={16} />}
          <span className="hidden sm:inline">{status === "open" ? "Çözüldü" : "Yeniden aç"}</span>
        </button>
      </header>
      <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-line pt-2">
        <SupportChat
          initial={initial}
          threadId={info.id}
          emptyHint="Bu sohbette mesaj yok."
          onPolled={(d) => {
            const s = (d as { thread?: { status: "open" | "closed" } }).thread?.status;
            if (s) setStatus(s);
          }}
        />
      </div>
    </div>
  );
}
