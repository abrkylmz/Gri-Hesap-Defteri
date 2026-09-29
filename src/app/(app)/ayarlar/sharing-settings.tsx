"use client";

import { Check, Clock, LogOut, UserPlus, Users, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  inviteMember,
  leaveLedger,
  removeMember,
  respondInvitation,
  switchLedger,
} from "@/lib/actions/sharing";
import type { ActionResult } from "@/lib/action-utils";
import type { Invitation, LedgerAccess, Member } from "@/lib/scope";
import { useApp } from "@/components/app-context";
import { ConfirmButton } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { cn, Spinner } from "@/components/ui";

export type SharingData = { ledgers: LedgerAccess[]; invitations: Invitation[]; members: Member[] };

export function SharingSettings({ sharing }: { sharing: SharingData }) {
  const { ledger } = useApp();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState("");

  const run = (fn: () => Promise<ActionResult>, success: string, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      toast(res.ok ? success : res.error, res.ok ? "default" : "error");
      if (res.ok) after?.();
    });

  const invite = () => {
    const name = username.trim();
    if (!name) return;
    run(() => inviteMember(name), `${name.toLowerCase()} davet edildi`, () => setUsername(""));
  };

  const shared = sharing.ledgers.filter((l) => !l.own);

  return (
    <div className="space-y-6">
      {/* Bana gelen davetler */}
      {sharing.invitations.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Sana gelen davetler</p>
          {sharing.invitations.map((inv) => (
            <div key={inv.ownerId} className="card flex items-center gap-3 px-4 py-3">
              <Avatar name={inv.ownerName} />
              <p className="min-w-0 flex-1 truncate text-sm">
                <strong>{inv.ownerName}</strong> defterine davet etti
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => respondInvitation(inv.ownerId, false), "Davet reddedildi")}
                className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
                aria-label="Reddet"
              >
                <X size={16} />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => respondInvitation(inv.ownerId, true), `${inv.ownerName} adlı kişinin defterine geçtin`)}
                className="btn btn-primary h-9 px-3 text-sm"
              >
                <Check size={15} /> Kabul et
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Kendi defterimi paylaştıklarım */}
      <div>
        <p className="font-medium">Defterini paylaş</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
          Davet ettiğin kişi kabul edince gelir-giderlerini, kategorilerini ve düzenli kayıtlarını görüp
          düzenleyebilir. Halka arz portföyün kişiseldir, paylaşılmaz.
        </p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            invite();
          }}
        >
          <input
            className="input"
            placeholder="Kullanıcı adı"
            value={username}
            maxLength={32}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button type="submit" disabled={pending || !username.trim()} className="btn btn-primary h-12 shrink-0">
            {pending ? <Spinner /> : <UserPlus size={17} />} Davet et
          </button>
        </form>

        {sharing.members.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {sharing.members.map((m) => (
              <li key={m.memberId} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.username} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.username}</span>
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs",
                      m.status === "accepted" ? "text-income" : "text-ink-3",
                    )}
                  >
                    {m.status === "accepted" ? (
                      <>
                        <Check size={11} /> Erişimi var · düzenleyebilir
                      </>
                    ) : (
                      <>
                        <Clock size={11} /> Davet bekliyor
                      </>
                    )}
                  </span>
                </span>
                <ConfirmButton
                  className="h-9 px-3 text-xs"
                  disabled={pending}
                  confirmText={m.status === "accepted" ? "Erişimi kaldır?" : "Geri çek?"}
                  onConfirm={() => run(() => removeMember(m.memberId), `${m.username} kaldırıldı`)}
                >
                  {m.status === "accepted" ? "Kaldır" : "Geri çek"}
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Benimle paylaşılan defterler */}
      {shared.length > 0 && (
        <div>
          <p className="font-medium">Seninle paylaşılan defterler</p>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {shared.map((l) => {
              const current = ledger.ownerId === l.ownerId;
              return (
                <li key={l.ownerId} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={l.name} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <strong>{l.name}</strong> adlı kişinin defteri
                    {current && <span className="ml-2 text-xs text-income">· şu an açık</span>}
                  </span>
                  {!current && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => switchLedger(l.ownerId), `${l.name} adlı kişinin defterine geçtin`)}
                      className="btn btn-ghost h-9 px-3 text-xs"
                    >
                      <Users size={14} /> Aç
                    </button>
                  )}
                  <ConfirmButton
                    className="h-9 px-3 text-xs"
                    disabled={pending}
                    confirmText="Ayrılınsın mı?"
                    onConfirm={() => run(() => leaveLedger(l.ownerId), `${l.name} adlı kişinin defterinden ayrıldın`)}
                  >
                    <LogOut size={14} />
                  </ConfirmButton>
                </li>
              );
            })}
          </ul>
          {ledger.shared && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => switchLedger(null), "Kendi defterine döndün")}
              className="btn btn-ghost mt-3 w-full text-sm"
            >
              Kendi defterime dön
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 font-serif text-lg uppercase italic"
    >
      {name.slice(0, 1)}
    </span>
  );
}
