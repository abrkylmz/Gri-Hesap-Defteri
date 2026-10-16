"use client";

import Link from "next/link";
import { Bell, Check, ChevronRight, LifeBuoy, PenLine, PiggyBank, Sparkles, Wallet, X } from "lucide-react";
import { useTransition } from "react";
import { dismissOnboarding } from "@/lib/actions/home";
import { useApp } from "@/components/app-context";
import { useTxSheet } from "@/components/tx-sheet";
import { usePush } from "@/components/use-push";
import { cn, Spinner } from "@/components/ui";

export type OnboardingState = {
  hasTx: boolean;
  hasAssets: boolean;
  hasBudget: boolean;
  hasPush: boolean;
  hasRecovery?: boolean;
};

/**
 * İlk kullanım rehberi: dört adım, yapıldıkça kendiliğinden işaretlenir. Kapatınca bir daha gösterilmez
 * (Ayarlar'dan geri açılabilir). Yalnızca kendi defterinde gösterilir.
 */
export function OnboardingCard({ state }: { state: OnboardingState }) {
  const { vapidPublicKey } = useApp();
  const { openNew } = useTxSheet();
  const push = usePush(vapidPublicKey);
  const [closing, startClose] = useTransition();
  const pushOn = state.hasPush || push.status === "on";
  const pushImpossible = ["unsupported", "unconfigured", "denied"].includes(push.status);

  const steps = [
    {
      key: "tx",
      done: state.hasTx,
      icon: PenLine,
      title: "İlk kaydını ekle",
      desc: "Bugünkü bir harcamanı ya da maaşını yaz.",
      action: { label: "Ekle", onClick: () => openNew() },
    },
    {
      key: "assets",
      done: state.hasAssets,
      icon: Wallet,
      title: "Hesaplarını ve varlıklarını gir",
      desc: "Banka hesapları, döviz, altın ya da kripto; net varlığın hesaplansın.",
      action: { label: "Gir", href: "/varliklar?ekle=cash" },
    },
    {
      key: "budget",
      done: state.hasBudget,
      icon: PiggyBank,
      title: "Bir kategoriye bütçe koy",
      desc: "Market için aylık ₺8.000 gibi; %80'e gelince uyarırız.",
      action: { label: "Bütçe koy", href: "/kategoriler" },
    },
    {
      key: "push",
      done: pushOn,
      icon: Bell,
      title: "Bildirimleri aç",
      desc:
        push.status === "ios-install"
          ? "iPhone'da önce Paylaş → Ana Ekrana Ekle ile uygulamayı yükle."
          : pushImpossible
            ? "Bu cihazda bildirim kullanılamıyor; diğer adımlarla devam edebilirsin."
            : "Ödeme günleri, kart son ödemesi ve bütçe uyarıları için.",
      action: push.status === "off" ? { label: push.pending ? "…" : "Aç", onClick: push.enable } : null,
    },
    {
      key: "recovery",
      done: Boolean(state.hasRecovery),
      icon: LifeBuoy,
      title: "Kurtarma kodu oluştur",
      desc: "Şifreni unutursan hesabına bu kodla geri dönersin.",
      action: { label: "Oluştur", href: "/ayarlar#hesap" },
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  const close = () => startClose(async () => void (await dismissOnboarding().catch(() => null)));

  return (
    <section aria-label="Başlangıç rehberi" className="card rise relative mt-4 overflow-hidden p-4 sm:p-5">
      <button
        type="button"
        onClick={close}
        disabled={closing}
        aria-label="Rehberi kapat"
        className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
      >
        {closing ? <Spinner /> : <X size={16} />}
      </button>
      <p className="flex items-center gap-2 pr-10 text-sm font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-income-fill/20 text-income">
          <Sparkles size={15} />
        </span>
        {allDone ? "Hazırsın! Defterin kuruldu." : "Gri Hesap Defteri'ne hoş geldin"}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <span
            className="block h-full rounded-full bg-income-fill transition-[width] duration-700"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </span>
        <span className="num text-xs text-ink-3">
          {doneCount}/{steps.length}
        </span>
      </div>

      <ol className="mt-3 space-y-1">
        {steps.map((s) => {
          const Icon = s.icon;
          const a = s.action;
          return (
            <li key={s.key} className="flex items-center gap-3 rounded-xl py-1.5">
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full",
                  s.done ? "bg-income-fill text-on-fill" : "bg-surface-2 text-ink-2",
                )}
              >
                {s.done ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-medium", s.done && "text-ink-3 line-through")}>{s.title}</span>
                {!s.done && <span className="block text-xs leading-snug text-ink-3">{s.desc}</span>}
              </span>
              {!s.done &&
                a &&
                ("href" in a && a.href ? (
                  <Link
                    href={a.href}
                    className="flex h-8 shrink-0 items-center gap-0.5 rounded-full bg-ink px-3 text-xs font-semibold text-bg"
                  >
                    {a.label} <ChevronRight size={13} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={"onClick" in a ? a.onClick : undefined}
                    className="h-8 shrink-0 rounded-full bg-ink px-3 text-xs font-semibold text-bg"
                  >
                    {a.label}
                  </button>
                ))}
            </li>
          );
        })}
      </ol>
      {allDone && (
        <button type="button" onClick={close} disabled={closing} className="btn btn-primary mt-3 w-full">
          Tamam, kapat
        </button>
      )}
    </section>
  );
}
