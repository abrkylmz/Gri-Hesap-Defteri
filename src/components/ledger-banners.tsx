"use client";

import { ArrowLeftRight, BookOpen, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { respondInvitation, switchLedger } from "@/lib/actions/sharing";
import type { Invitation } from "@/lib/scope";
import { useApp } from "@/components/app-context";
import { useToast } from "@/components/toast";
import { cn, Spinner } from "@/components/ui";

/**
 * Sayfaların tepesindeki şeritler:
 * - Bekleyen davetler (kabul / reddet)
 * - Başkasının defterindeyken bunu hatırlatan şerit ve defter değiştirici
 */
export function LedgerBanners({ invitations }: { invitations: Invitation[] }) {
  const { ledger, ledgers } = useApp();
  const pathname = usePathname();
  // Halka arz ve yönetim kişiseldir; defter şeritleri orada yanıltıcı olur.
  if (pathname.startsWith("/halka-arz") || pathname.startsWith("/yonetim")) return null;
  if (invitations.length === 0 && !ledger.shared && ledgers.length < 2) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-2 px-5 pt-3 lg:px-10 lg:pt-6">
      {invitations.map((inv) => (
        <InvitationBanner key={inv.ownerId} invitation={inv} />
      ))}
      {ledgers.length > 1 && <LedgerSwitcher />}
    </div>
  );
}

function InvitationBanner({ invitation }: { invitation: Invitation }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const respond = (accept: boolean) =>
    startTransition(async () => {
      const res = await respondInvitation(invitation.ownerId, accept);
      toast(
        res.ok ? (accept ? `${invitation.ownerName} adlı kişinin defterine geçtin` : "Davet reddedildi") : res.error,
        res.ok ? "default" : "error",
      );
    });

  return (
    <div className="rise flex flex-col gap-3 rounded-2xl border border-income/30 bg-income-fill/10 px-4 py-3 sm:flex-row sm:items-center">
      <p className="flex min-w-0 flex-1 items-start gap-3 text-sm">
        <Users size={18} className="mt-0.5 shrink-0 text-income" />
        <span>
          <strong>{invitation.ownerName}</strong> seni defterine davet etti. Kabul edersen gelir-giderlerini görüp
          düzenleyebilirsin.
        </span>
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" disabled={pending} onClick={() => respond(false)} className="btn btn-ghost h-9 px-3 text-sm">
          Reddet
        </button>
        <button type="button" disabled={pending} onClick={() => respond(true)} className="btn btn-primary h-9 px-4 text-sm">
          {pending && <Spinner />} Kabul et
        </button>
      </div>
    </div>
  );
}

/** Birden çok deftere erişen kullanıcı için defter seçici. Paylaşılan defterdeyken vurgulanır. */
export function LedgerSwitcher({ compact = false }: { compact?: boolean }) {
  const { ledger, ledgers } = useApp();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const change = (ownerId: string) =>
    startTransition(async () => {
      const target = ledgers.find((l) => l.ownerId === ownerId);
      const res = await switchLedger(target?.own ? null : ownerId);
      if (!res.ok) toast(res.error, "error");
    });

  return (
    <label
      className={cn(
        "relative flex items-center gap-2 rounded-2xl px-4 text-sm transition-colors",
        compact ? "h-10" : "h-12",
        ledger.shared ? "bg-ink text-bg" : "border border-line bg-surface",
      )}
    >
      {pending ? <Spinner /> : ledger.shared ? <Users size={16} /> : <BookOpen size={16} />}
      <span className="min-w-0 flex-1 truncate">
        {ledger.shared ? (
          <>
            <strong>{ledger.ownerName}</strong> adlı kişinin defterindesin
          </>
        ) : (
          "Kendi defterin"
        )}
      </span>
      <span className={cn("flex items-center gap-1 text-xs", ledger.shared ? "text-bg/70" : "text-ink-3")}>
        <ArrowLeftRight size={13} /> Değiştir
      </span>
      {/* Yerel <select>: iOS/Android'de sistemin kendi seçicisini açar. */}
      <select
        aria-label="Defter seç"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={ledger.ownerId}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
      >
        {ledgers.map((l) => (
          <option key={l.ownerId} value={l.ownerId}>
            {l.own ? "Kendi defterim" : `${l.name} adlı kişinin defteri`}
          </option>
        ))}
      </select>
    </label>
  );
}
