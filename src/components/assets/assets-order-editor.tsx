"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState, useTransition } from "react";
import { saveAssetsOrder } from "@/lib/actions/home";
import { assetBlock, type AssetBlockKey } from "@/lib/assets-layout";
import { haptic } from "@/lib/haptics";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { Spinner } from "@/components/ui";

/** Varlıklar sayfasındaki bölümleri yukarı/aşağı taşıma. Kişiseldir (tüm cihazlarda aynı). */
export function AssetsOrderEditor({
  initial,
  onDone,
}: {
  initial: AssetBlockKey[];
  onDone: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [order, setOrder] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const move = (index: number, delta: -1 | 1) => {
    const j = index + delta;
    if (j < 0 || j >= order.length) return;
    haptic("tap");
    setOrder((o) => {
      const next = [...o];
      [next[index], next[j]] = [next[j]!, next[index]!];
      return next;
    });
  };

  const save = (value: AssetBlockKey[] | null, msg: string) =>
    startTransition(async () => {
      const res = await saveAssetsOrder(value).catch(() => ({
        ok: false as const,
        error: "Bağlantı kurulamadı. Tekrar dene.",
      }));
      if (!res.ok) return setError(res.error);
      toast(msg);
      setOpen(false);
    });

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      onExited={onDone}
      title="Varlıklar düzeni"
      footer={
        <div className="flex gap-2 pb-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => save(null, "Varsayılan sıraya dönüldü")}
            className="btn btn-ghost px-4 text-sm"
          >
            Varsayılan
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save(order, "Sıra kaydedildi")}
            className="btn btn-primary flex-1"
          >
            {pending && <Spinner />} Kaydet
          </button>
        </div>
      }
    >
      <div className="space-y-4 pb-5">
        <p className="text-sm text-ink-2">
          Bölümlerin sırasını oklarla değiştir. Toplam varlık her zaman en üstte
          kalır; art arda gelen kartlar bilgisayarda iki sütunda yan yana durur.
        </p>
        <ol className="space-y-2">
          {order.map((key, i) => {
            const b = assetBlock(key);
            return (
              <li
                key={key}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5"
              >
                <span className="num grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-sm font-semibold text-ink-2">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {b.label}
                  </span>
                  <span className="block text-[11px] leading-snug text-ink-3">
                    {b.desc}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`${b.label}: yukarı taşı`}
                    className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-25"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === order.length - 1}
                    aria-label={`${b.label}: aşağı taşı`}
                    className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-25"
                  >
                    <ArrowDown size={16} />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
