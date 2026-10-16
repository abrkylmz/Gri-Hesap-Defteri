"use client";

import { Bug, ChevronDown, Megaphone, Monitor, Send, Server, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { clearErrors, sendAnnouncement } from "@/lib/actions/admin";
import type { AppError } from "@/lib/errors";
import { ConfirmButton } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Spinner } from "@/components/ui";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  createdMs: number;
  audience: number;
  delivered: number;
};

const timeFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const num = new Intl.NumberFormat("tr-TR");

/** Duyuru oluştur: uygulamada şerit + bildirim. Önizleme ve geçmiş duyurular. */
export function AnnounceSection({ history }: { history: AnnouncementRow[] }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "active">("all");
  const [pending, start] = useTransition();
  const ready = title.trim() && body.trim();

  const send = () =>
    start(async () => {
      const res = await sendAnnouncement({ title, body, audience }).catch(() => ({
        ok: false as const,
        error: "Bağlantı kurulamadı.",
      }));
      if (!res.ok) return void toast(res.error, "error");
      toast(`Duyuru gönderildi · ${num.format(res.audience)} kişi, ${num.format(res.delivered)} cihaza bildirim`);
      setTitle("");
      setBody("");
    });

  return (
    <section className="card rise mt-4 p-4 sm:p-5" aria-label="Duyuru gönder">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-violet-500/12 text-violet-600 dark:text-violet-300">
          <Megaphone size={15} />
        </span>
        Duyuru gönder
      </p>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-2">
          <input
            className="input"
            placeholder="Başlık · ör. Yeni: kredi kartı dönemi"
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Duyuru başlığı"
          />
          <textarea
            className="input min-h-24 resize-y py-3"
            placeholder="Mesaj · ör. Varlıklar → Limitlerim'de kartına son ödeme gününü ekle; 3 gün kala hatırlatalım."
            maxLength={500}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Duyuru mesajı"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Kime" className="flex rounded-full bg-surface-2 p-0.5">
              {(
                [
                  ["all", "Herkese"],
                  ["active", "Son 30 gün aktif"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={audience === k}
                  onClick={() => setAudience(k)}
                  className={cn(
                    "h-8 rounded-full px-3 text-xs font-medium",
                    audience === k ? "bg-surface text-ink shadow-sm" : "text-ink-3",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="num ml-auto text-[11px] text-ink-3">{body.length}/500</span>
            <ConfirmButton disabled={!ready || pending} confirmText="Evet, gönder" onConfirm={send}>
              {pending ? <Spinner /> : <Send size={15} />} Gönder
            </ConfirmButton>
          </div>
        </div>
        {/* Önizleme: kullanıcının göreceği şerit */}
        <div className="rounded-2xl border border-dashed border-line p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-ink-3">Önizleme</p>
          <div className="mt-2 flex gap-2.5 rounded-xl border border-violet-500/25 bg-violet-500/[0.07] p-3">
            <Megaphone size={15} className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-300" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{title || "Başlık"}</span>
              <span className="mt-0.5 block whitespace-pre-wrap break-words text-xs text-ink-2">{body || "Mesaj"}</span>
            </span>
          </div>
        </div>
      </div>
      {history.length > 0 && (
        <details className="group mt-4 border-t border-line pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-ink-2">
            Geçmiş duyurular ({history.length})
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-2 space-y-2">
            {history.map((a) => (
              <li key={a.id} className="rounded-xl bg-surface-2/50 px-3 py-2">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{a.title}</span>
                  <span className="num shrink-0 text-[11px] text-ink-3">{timeFmt.format(a.createdMs)}</span>
                </span>
                <span className="block text-xs text-ink-3">
                  {num.format(a.audience)} kişi · {num.format(a.delivered)} cihaza bildirim
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Son hatalar: sunucu ve tarayıcı hataları, tekrar sayısıyla. */
export function ErrorsSection({ errors }: { errors: AppError[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const clear = () =>
    start(async () => {
      const res = await clearErrors().catch(() => ({ ok: false as const, error: "Bağlantı kurulamadı." }));
      toast(res.ok ? "Hata listesi temizlendi" : res.error, res.ok ? "default" : "error");
    });

  return (
    <section className="card rise mt-4 p-4 sm:p-5" aria-label="Son hatalar">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span
            className={cn(
              "grid size-7 place-items-center rounded-lg",
              errors.length ? "bg-expense/12 text-expense" : "bg-income-fill/20 text-income",
            )}
          >
            <Bug size={15} />
          </span>
          Son hatalar
          <span className="font-normal text-ink-3">· {errors.length ? `${errors.length} farklı hata` : "temiz"}</span>
        </p>
        {errors.length > 0 && (
          <ConfirmButton disabled={pending} confirmText="Temizle" onConfirm={clear}>
            {pending ? <Spinner /> : <Trash2 size={14} />} Temizle
          </ConfirmButton>
        )}
      </div>
      {errors.length === 0 ? (
        <p className="mt-3 text-xs text-ink-3">
          Kayıtlı hata yok. Sunucuda ya da tarayıcıda hata olursa burada görünür.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {errors.map((e) => (
            <li key={e.id} className="flex items-start gap-3 py-2.5">
              <span
                className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3"
                title={e.source === "server" ? "Sunucu" : "Tarayıcı"}
              >
                {e.source === "server" ? <Server size={14} /> : <Monitor size={14} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words font-mono text-xs leading-snug text-ink">{e.message}</span>
                <span className="mt-0.5 block text-[11px] text-ink-3">
                  {e.path ?? "—"} · son {timeFmt.format(e.lastMs)}
                  {e.digest && <> · kod {e.digest}</>}
                </span>
              </span>
              <span className="num shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold">
                ×{num.format(e.count)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
