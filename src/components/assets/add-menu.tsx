"use client";

import { Bitcoin, ChevronRight, Coins, CreditCard, Plus, Wallet, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { haptic } from "@/lib/haptics";
import { Sheet } from "@/components/sheet";
import { requestAdd, type AddKind } from "./add-request";

const OPTIONS: { kind: AddKind; label: string; desc: string; icon: LucideIcon; tone: string }[] = [
  { kind: "cash", label: "Nakit hesap", desc: "Banka hesabı, cüzdan, birikim", icon: Wallet, tone: "bg-income-fill/20 text-income" },
  { kind: "limit", label: "Limit", desc: "Kredi kartı ya da ek hesap limiti", icon: CreditCard, tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  { kind: "fx", label: "Döviz / altın", desc: "Dolar, euro, gram altın, çeyrek…", icon: Coins, tone: "bg-amber-400/20 text-amber-700 dark:text-amber-300" },
  { kind: "crypto", label: "Kripto", desc: "BTC, ETH, PI… istediğin coin", icon: Bitcoin, tone: "bg-orange-500/15 text-orange-600 dark:text-orange-300" },
];

/**
 * Varlıklar sayfasının sağ alttaki "Ekle" düğmesi ve "Ne eklemek istiyorsun?" menüsü.
 * Seçilen türün ekleme penceresi açılır. (Alttaki menünün ortasındaki + gelir/gider ekler;
 * karışmasın diye bu düğme yazılıdır ve onun üstünde durur.)
 */
export function AddMenu({ onAddFx }: { onAddFx: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<AddKind | null>(null);

  const choose = (kind: AddKind) => {
    haptic("select");
    setPending(kind);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic("tap");
          setOpen(true);
        }}
        aria-haspopup="dialog"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-5 z-30 flex h-12 items-center gap-1.5 rounded-full bg-ink pl-4 pr-5 text-sm font-semibold text-bg shadow-[0_12px_30px_-10px_rgb(0_0_0/0.55)] transition-transform active:scale-95 lg:bottom-8 lg:right-8"
      >
        <Plus size={18} strokeWidth={2.5} /> Ekle
      </button>

      {(open || pending) && (
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          // Menü kapanınca seçilen ekleme penceresi açılır (iki pencere üst üste binmesin).
          onExited={() => {
            const kind = pending;
            setPending(null);
            if (kind === "fx") onAddFx();
            else if (kind) requestAdd(kind);
          }}
          title="Ne eklemek istiyorsun?"
        >
          <ul className="space-y-2 pb-5">
            {OPTIONS.map((o) => (
              <li key={o.kind}>
                <button
                  type="button"
                  onClick={() => choose(o.kind)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${o.tone}`}>
                    <o.icon size={19} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{o.label}</span>
                    <span className="block truncate text-xs text-ink-3">{o.desc}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-ink-3" />
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </>
  );
}
