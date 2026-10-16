"use client";

import { ArrowUp, Headset, Zap } from "lucide-react";
import { SnippetsSheet } from "./snippets-sheet";
import type { SupportSnippet } from "@/lib/support";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { replySupport, sendSupportMessage } from "@/lib/actions/support";
import { haptic } from "@/lib/haptics";
import type { SupportMessage } from "@/lib/support";
import { useApp } from "@/components/app-context";
import { useToast } from "@/components/toast";
import { cn, Spinner } from "@/components/ui";

const POLL_MS = 5000;
const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long" });
const timeFmt = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

type Pending = { id: string; body: string; createdMs: number; failed?: boolean };

/**
 * Sohbet ekranı. `threadId` verilirse ekip görünümüdür (kendi mesajları "ekip" tarafıdır);
 * verilmezse kullanıcının kendi destek sohbetidir. Sayfa görünürken birkaç saniyede bir yeni mesajları çeker.
 */
export function SupportChat({
  initial,
  threadId,
  emptyHint,
  onPolled,
  snippets,
}: {
  initial: SupportMessage[];
  threadId?: string;
  emptyHint?: React.ReactNode;
  /** Her yoklamada sunucudan gelen ham yanıt (ör. sohbet durumu) */
  onPolled?: (data: unknown) => void;
  /** Ekip görünümü: hazır yanıtlar */
  snippets?: SupportSnippet[];
}) {
  const staffView = Boolean(threadId);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const router = useRouter();
  const { support } = useApp();
  // Okunmamış rozeti (menüdeki kırmızı nokta) sayfa açılınca hemen sönsün.
  const badgeStale = useRef(staffView ? support.inbox > 0 : support.own > 0);
  const toast = useToast();
  const [messages, setMessages] = useState(initial);
  const [pending, setPending] = useState<Pending[]>([]);
  const [text, setText] = useState("");
  const [sending, startSend] = useTransition();
  const listEnd = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const onPolledRef = useRef(onPolled);
  useEffect(() => {
    onPolledRef.current = onPolled;
  });

  const url = threadId ? `/api/destek?thread=${threadId}` : "/api/destek";
  const poll = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { messages: SupportMessage[] };
      setMessages(data.messages);
      onPolledRef.current?.(data);
      if (badgeStale.current) {
        badgeStale.current = false;
        router.refresh();
      }
    } catch {
      /* çevrimdışı: bir sonraki yoklamada tekrar denenir */
    }
  }, [url, router]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      if (document.visibilityState === "visible") {
        void poll();
        timer = setInterval(poll, POLL_MS);
      }
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, [poll]);

  // Yeni mesaj gelince en alta kaydır.
  const count = messages.length + pending.length;
  useLayoutEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [count]);

  const send = () => {
    const body = text.trim();
    if (!body || sending) return;
    const temp: Pending = { id: `p${Date.now()}`, body, createdMs: Date.now() };
    setPending((p) => [...p, temp]);
    setText("");
    haptic("tap");
    startSend(async () => {
      const res = await (threadId ? replySupport(threadId, body) : sendSupportMessage(body)).catch(() => ({
        ok: false as const,
        error: "Bağlantı kurulamadı. Tekrar dene.",
      }));
      if (!res.ok) {
        toast(res.error, "error");
        setPending((p) => p.map((x) => (x.id === temp.id ? { ...x, failed: true } : x)));
        setText((t) => t || body);
        return;
      }
      await poll();
      setPending((p) => p.filter((x) => x.id !== temp.id));
    });
  };

  // Mesajlar günlere ayrılır.
  const rows: (
    | { type: "day"; key: string; label: string }
    | { type: "msg"; m: SupportMessage | Pending; mine: boolean; pending?: boolean; failed?: boolean }
  )[] = [];
  let lastDay = "";
  for (const m of [...messages, ...pending]) {
    const day = dayFmt.format(m.createdMs);
    if (day !== lastDay) {
      rows.push({ type: "day", key: `d${m.createdMs}`, label: day });
      lastDay = day;
    }
    const isPending = "failed" in m || m.id.startsWith("p");
    const mine = isPending ? true : staffView ? (m as SupportMessage).fromStaff : !(m as SupportMessage).fromStaff;
    rows.push({ type: "msg", m, mine, pending: isPending && !(m as Pending).failed, failed: (m as Pending).failed });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-1.5 pb-4" aria-live="polite">
        {rows.length === 0 && (
          <div className="mx-auto mt-6 max-w-sm rounded-3xl border border-dashed border-line p-6 text-center text-sm text-ink-2">
            <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-sky-500/12 text-sky-700 dark:text-sky-300">
              <Headset size={22} />
            </span>
            {emptyHint}
          </div>
        )}
        {rows.map((r) =>
          r.type === "day" ? (
            <p key={r.key} className="py-3 text-center text-[11px] font-medium text-ink-3 first-letter:uppercase">
              {r.label}
            </p>
          ) : (
            <div key={r.m.id} className={cn("flex", r.mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[82%] rounded-3xl px-4 py-2.5 text-[15px] leading-snug shadow-sm",
                  r.mine ? "rounded-br-lg bg-ink text-bg" : "rounded-bl-lg border border-line bg-surface text-ink",
                  r.pending && "opacity-60",
                  r.failed && "ring-2 ring-expense",
                )}
              >
                {!r.mine && "fromStaff" in r.m && r.m.fromStaff && (
                  <p className="mb-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                    {r.m.sender ? `${r.m.sender} · Destek` : "Destek ekibi"}
                  </p>
                )}
                {staffView && r.mine && "sender" in r.m && r.m.sender && (
                  <p className="mb-0.5 text-[11px] font-semibold opacity-60">{r.m.sender}</p>
                )}
                <p className="whitespace-pre-wrap break-words">{r.m.body}</p>
                <p className={cn("mt-1 text-right text-[10px]", r.mine ? "opacity-55" : "text-ink-3")}>
                  {r.failed ? "gönderilemedi" : r.pending ? "gönderiliyor…" : timeFmt.format(r.m.createdMs)}
                </p>
              </div>
            </div>
          ),
        )}
        {/* Kaydırınca son mesaj yazma alanının ve alt menünün üstünde kalsın */}
        <div ref={listEnd} className="scroll-mb-[calc(env(safe-area-inset-bottom)+10rem)] lg:scroll-mb-28" />
      </div>

      {/* Yazma alanı: telefonda alt menünün hemen üstünde sabit */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-20 -mx-2 flex items-end gap-2 rounded-[1.75rem] border border-line bg-surface p-2 shadow-lg lg:bottom-4"
      >
        {snippets && (
          <button
            type="button"
            onClick={() => setSnippetsOpen(true)}
            aria-label="Hazır yanıtlar"
            title="Hazır yanıtlar"
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <Zap size={19} />
          </button>
        )}
        <label htmlFor="support-text" className="sr-only">
          Mesajın
        </label>
        <textarea
          id="support-text"
          ref={area}
          rows={1}
          maxLength={2000}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            // Masaüstünde Enter gönderir, Shift+Enter yeni satır.
            if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={staffView ? "Yanıtını yaz…" : "Mesajını yaz…"}
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-ink-3"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Gönder"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-bg transition-opacity disabled:opacity-30"
        >
          {sending ? <Spinner /> : <ArrowUp size={20} strokeWidth={2.5} />}
        </button>
      </form>
      {snippetsOpen && snippets && (
        <SnippetsSheet
          snippets={snippets}
          onDone={() => setSnippetsOpen(false)}
          onPick={(body) => {
            setText((t) => (t.trim() ? `${t.trimEnd()}

${body}` : body));
            requestAnimationFrame(() => area.current?.focus());
          }}
        />
      )}
    </div>
  );
}
