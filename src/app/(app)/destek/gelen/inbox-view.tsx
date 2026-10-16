"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { SupportThread } from "@/lib/support";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/components/ui";

const POLL_MS = 8000;
const timeFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Destek kutusu: tüm sohbetler; okunmamışlar vurgulu. Sayfa açıkken kendini günceller. */
export function InboxView({ initial }: { initial: SupportThread[] }) {
  const [threads, setThreads] = useState(initial);
  const [filter, setFilter] = useState<"open" | "closed">("open");

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const poll = async () => {
      try {
        const res = await fetch("/api/destek?inbox=1", { cache: "no-store" });
        if (res.ok) setThreads(((await res.json()) as { threads: SupportThread[] }).threads);
      } catch {
        /* çevrimdışı */
      }
    };
    const start = () => {
      clearInterval(timer);
      if (document.visibilityState === "visible") timer = setInterval(poll, POLL_MS);
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, []);

  const shown = threads.filter((t) => t.status === filter);
  const openCount = threads.filter((t) => t.status === "open").length;
  const waiting = threads.filter((t) => t.status === "open" && t.unread).length;

  return (
    <div className="mx-auto max-w-2xl px-5 lg:px-10">
      <PageHeader eyebrow="Ekip" title="Destek kutusu">
        {waiting > 0 ? `${waiting} sohbet yanıt bekliyor.` : "Yanıt bekleyen sohbet yok."}
      </PageHeader>

      <div className="mt-6 flex gap-1.5">
        {(
          [
            ["open", `Açık (${openCount})`],
            ["closed", `Çözüldü (${threads.length - openCount})`],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-dashed border-line p-8 text-center text-sm text-ink-2">
          {filter === "open" ? "Açık sohbet yok." : "Henüz çözülmüş sohbet yok."}
        </p>
      ) : (
        <ul className="card mt-4 divide-y divide-line overflow-hidden">
          {shown.map((t) => (
            <li key={t.id}>
              <Link
                href={`/destek/gelen/${t.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2"
              >
                <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold uppercase">
                  {t.username.slice(0, 1)}
                  {t.unread && (
                    <span
                      aria-label="Yanıt bekliyor"
                      className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-expense ring-2 ring-surface"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", t.unread ? "font-semibold" : "font-medium")}>
                      {t.username}
                    </span>
                    <span className="num shrink-0 text-[11px] text-ink-3">{timeFmt.format(t.lastMessageMs)}</span>
                  </span>
                  <span className={cn("block truncate text-xs", t.unread ? "text-ink" : "text-ink-3")}>
                    {t.lastFromStaff && <span className="text-ink-3">Ekip: </span>}
                    {t.preview}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
