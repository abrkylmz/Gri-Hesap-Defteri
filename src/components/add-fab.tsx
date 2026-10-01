"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Bitcoin,
  ChevronRight,
  Coins,
  CreditCard,
  Landmark,
  Plus,
  Repeat,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { haptic } from "@/lib/haptics";
import { ADD_KINDS, requestAddWhenReady, type AddKind } from "@/components/assets/add-request";
import { Sheet } from "@/components/sheet";
import { useTxSheet } from "@/components/tx-sheet";

type Choice = "expense" | "income" | AddKind;

const GROUPS: { title: string; items: { key: Choice; label: string; desc: string; icon: LucideIcon; tone: string }[] }[] = [
  {
    title: "Kayıt",
    items: [
      { key: "expense", label: "Gider", desc: "Harcama, fatura, ödeme", icon: ArrowUpRight, tone: "bg-expense/12 text-expense" },
      { key: "income", label: "Gelir", desc: "Maaş, ek gelir, iade", icon: ArrowDownLeft, tone: "bg-income-fill/20 text-income" },
      { key: "recurring", label: "Düzenli ödeme", desc: "Kira, abonelik, maaş — her ay", icon: Repeat, tone: "bg-sky-500/12 text-sky-700 dark:text-sky-300" },
    ],
  },
  {
    title: "Varlık",
    items: [
      { key: "cash", label: "Nakit hesap", desc: "Banka hesabı, cüzdan, birikim", icon: Wallet, tone: "bg-income-fill/20 text-income" },
      { key: "fx", label: "Döviz / altın", desc: "Dolar, euro, gram altın, çeyrek…", icon: Coins, tone: "bg-amber-400/20 text-amber-700 dark:text-amber-300" },
      { key: "crypto", label: "Kripto", desc: "BTC, ETH, PI… istediğin coin", icon: Bitcoin, tone: "bg-orange-500/15 text-orange-600 dark:text-orange-300" },
      { key: "goal", label: "Hedef", desc: "Araba, tatil, ev peşinatı…", icon: Target, tone: "bg-sky-500/12 text-sky-700 dark:text-sky-300" },
    ],
  },
  {
    title: "Borç ve limit",
    items: [
      { key: "limit", label: "Limit", desc: "Kredi kartı ya da ek hesap limiti", icon: CreditCard, tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
      { key: "loan", label: "Kredi", desc: "Hesapla, taksitleri deftere ekle", icon: Landmark, tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
    ],
  },
];

/** Her türün ekleme penceresinin bulunduğu sayfa */
const PAGE: Record<AddKind, string> = {
  cash: "/varliklar",
  limit: "/varliklar",
  fx: "/varliklar",
  crypto: "/varliklar",
  recurring: "/duzenli",
  loan: "/kredi",
  goal: "/hedefler",
};

const noop = () => () => {};

/**
 * Uygulamanın tek "+" düğmesi: her sayfada sağ altta sabit durur ve tüm ekleme işlemlerini açar.
 * Ekranın köküne (body) çizilir: sayfa geçiş animasyonları gibi dönüşüm uygulanan kapsayıcılar
 * sabit konumu bozmasın. Seçilen işlem başka sayfadaysa oraya gidilir ve pencere orada açılır.
 * (Adres çubuğundaki ?ekle=… de aynı şekilde açar; eski ?ekle=1 → döviz/altın.)
 */
export function AddFab() {
  const { openNew } = useTxSheet();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Choice | null>(null);
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  // ?ekle=<tür> ile gelindiyse ilgili pencereyi aç, adresi temizle.
  const fromQuery = params.get("ekle");
  useEffect(() => {
    if (!fromQuery) return;
    const kind = fromQuery === "1" ? "fx" : (fromQuery as AddKind);
    if (ADD_KINDS.includes(kind)) requestAddWhenReady(kind);
    router.replace(pathname, { scroll: false });
  }, [fromQuery, pathname, router]);

  // Başka sayfadaki bir işlem seçildiyse: önce oraya gidilir, istek ancak varınca gönderilir
  // (yoksa bulunulan sayfadaki aynı türden bir kart — ör. ana ekrandaki nakit kartı — yakalardı).
  const [queued, setQueued] = useState<AddKind | null>(null);
  useEffect(() => {
    if (!queued || pathname !== PAGE[queued]) return;
    requestAddWhenReady(queued);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- istek gönderildi, sıra boşalır
    setQueued(null);
  }, [queued, pathname]);

  const run = (choice: Choice) => {
    if (choice === "expense" || choice === "income") return openNew({ kind: choice });
    const page = PAGE[choice];
    if (pathname === page) return requestAddWhenReady(choice);
    setQueued(choice);
    router.push(page);
  };

  if (!mounted) return null;
  return createPortal(
    <>
      <button
        type="button"
        onClick={() => {
          haptic("tap");
          setOpen(true);
        }}
        aria-label="Ekle"
        aria-haspopup="dialog"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-5 z-40 grid size-14 place-items-center rounded-full bg-ink text-bg shadow-[0_14px_34px_-10px_rgb(0_0_0/0.6)] transition-transform active:scale-90 lg:bottom-8 lg:right-8"
      >
        <Plus size={26} strokeWidth={2.5} />
        <span className="absolute right-1 top-1 size-2.5 rounded-full border-2 border-ink bg-income-fill" />
      </button>

      {(open || pending) && (
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          // Menü kapanınca seçilen işlemin penceresi açılır (iki pencere üst üste binmesin).
          onExited={() => {
            const choice = pending;
            setPending(null);
            if (choice) run(choice);
          }}
          title="Ne eklemek istiyorsun?"
        >
          <div className="space-y-4 pb-5">
            {GROUPS.map((g) => (
              <section key={g.title}>
                <p className="eyebrow mb-2">{g.title}</p>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {g.items.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        onClick={() => {
                          haptic("select");
                          setPending(o.key);
                          setOpen(false);
                        }}
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
              </section>
            ))}
          </div>
        </Sheet>
      )}
    </>,
    document.body,
  );
}
