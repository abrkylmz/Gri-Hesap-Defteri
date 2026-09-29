"use client";

import { Bell, BellRing, Check, Pencil, Repeat, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { isBill } from "@/lib/ledger";
import type { TransactionRow } from "@/lib/types";
import { useApp, UNCATEGORIZED } from "@/components/app-context";
import { cn, Money } from "@/components/ui";

const ACTION_W = 72; // kaydırınca çıkan her eylem düğmesinin genişliği (px)
const START_PX = 10; // bu kadar yatay hareketten sonra kaydırma başlar

/**
 * Defter satırı.
 * - Dokun/tıkla → düzenle
 * - Dokunmatikte sola kaydır → (Hatırlat) / Düzenle / Sil
 * - Masaüstünde üzerine gelince (ya da klavye odağında) zil, kalem ve çöp simgeleri
 * - Hatırlatması olan giderde tutarın yanında zil işareti
 */
export function LedgerRow({
  tx,
  swiped,
  onSwipe,
  onEdit,
  onDelete,
  onRemind,
  onTogglePaid,
}: {
  tx: TransactionRow;
  swiped: boolean;
  onSwipe: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Yalnızca giderlerde: düzenleyiciyi hatırlatma açık olarak açar */
  onRemind: () => void;
  /** Ödendi (✓) kutusuna dokunulunca */
  onTogglePaid: () => void;
}) {
  const { currency, categoryById, today } = useApp();
  const cat = tx.category_id ? categoryById.get(tx.category_id) : undefined;
  const title = tx.note || cat?.name || UNCATEGORIZED.name;
  const income = tx.kind === "income";
  const planned = tx.occurred_on > today;
  // Düzenli kayıttan üretilen işlemler düzenli kaydın kendisiyle hatırlatılır.
  const remindable = !income && !tx.recurring_id;
  const reminding = remindable && !tx.paid && tx.remind_days !== null && tx.occurred_on >= today;
  // Ödenecek kayıtlarda boş daire; ödendiyse (sıradan bir harcama bile olsa) yeşil ✓.
  const showCheck = tx.paid || isBill(tx, today);
  const REVEAL = ACTION_W * (remindable ? 3 : 2);

  const drag = useRef<{ x: number; y: number; dx: number; active: boolean } | null>(null);
  const justDragged = useRef(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const offset = dragX ?? (swiped ? -REVEAL : 0);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, active: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(my) > START_PX && Math.abs(my) > Math.abs(mx)) {
        drag.current = null; // dikey kaydırma: sayfaya bırak
        return;
      }
      if (Math.abs(mx) < START_PX) return;
      d.active = true;
      try {
        // Parmak satırın dışına çıksa da hareket izlenmeye devam etsin.
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* İşaretçi bu arada bırakılmışsa yakalama gereksiz; kaydırma yine çalışır. */
      }
    }
    const base = swiped ? -REVEAL : 0;
    // Sağa en fazla kapalı konuma, sola biraz esneyerek açılır.
    d.dx = Math.min(0, Math.max(-REVEAL * 1.25, base + mx));
    setDragX(d.dx);
  };
  const onPointerEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    justDragged.current = true;
    setDragX(null);
    onSwipe(d.dx < -REVEAL / 2);
  };

  const onRowClick = () => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    if (swiped) return onSwipe(false);
    onEdit();
  };

  return (
    <li className="relative -mx-2 overflow-hidden rounded-xl">
      {/* Kaydırınca ortaya çıkan eylemler (yalnızca dokunmatik) */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex lg:hidden",
          // Kapalıyken tamamen gizli: yuvarlak köşelerden sızmaz, ekran okuyucuya görünmez.
          !swiped && dragX === null && "invisible",
        )}
        aria-hidden={!swiped}
      >
        {remindable && (
          <button
            type="button"
            tabIndex={swiped ? 0 : -1}
            onClick={() => {
              onSwipe(false);
              onRemind();
            }}
            className="flex w-[72px] flex-col items-center justify-center gap-1 bg-ink text-[11px] font-medium text-bg"
          >
            {reminding ? <BellRing size={17} /> : <Bell size={17} />} Hatırlat
          </button>
        )}
        <button
          type="button"
          tabIndex={swiped ? 0 : -1}
          onClick={() => {
            onSwipe(false);
            onEdit();
          }}
          className="flex w-[72px] flex-col items-center justify-center gap-1 bg-surface-2 text-[11px] font-medium text-ink"
        >
          <Pencil size={17} /> Düzenle
        </button>
        <button
          type="button"
          tabIndex={swiped ? 0 : -1}
          onClick={onDelete}
          className="flex w-[72px] flex-col items-center justify-center gap-1 bg-expense text-[11px] font-medium text-white"
        >
          <Trash2 size={17} /> Sil
        </button>
      </div>

      <div
        className={cn(
          "group relative flex touch-pan-y items-center bg-bg",
          dragX === null && "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <button
          type="button"
          onClick={onRowClick}
          aria-label={`${title}, düzenle`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-2 active:bg-surface-2"
        >
          <span
            aria-hidden
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl text-lg",
              income ? "bg-income-fill/20" : "bg-surface-2",
            )}
          >
            {cat?.emoji ?? UNCATEGORIZED.emoji}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-[15px] font-medium">{title}</span>
              <span className="leader" />
              {reminding && (
                <BellRing
                  size={14}
                  className="shrink-0 self-center text-expense"
                  aria-label={`${tx.remind_days === 0 ? "aynı gün" : `${tx.remind_days} gün önce`} hatırlatılacak`}
                />
              )}
              <Money
                minor={income ? tx.amount : -tx.amount}
                currency={currency}
                sign
                className={cn("shrink-0 text-[15px]", income && "text-income")}
              />
            </span>
            {(tx.note || tx.recurring_id || planned || tx.paid) && (
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                {tx.note && <span className="truncate">{cat?.name ?? UNCATEGORIZED.name}</span>}
                {tx.paid ? (
                  <span className="flex items-center gap-1 text-income">
                    <Check size={11} strokeWidth={3} /> ödendi
                  </span>
                ) : (
                  planned && <span className="flex items-center gap-1 text-ink-2">planlı</span>
                )}
                {tx.recurring_id && (
                  <span className="flex items-center gap-1">
                    <Repeat size={11} /> düzenli
                  </span>
                )}
              </span>
            )}
          </span>
        </button>

        {showCheck && (
          <button
            type="button"
            onClick={onTogglePaid}
            role="checkbox"
            aria-checked={tx.paid}
            aria-label={tx.paid ? `${title}: ödendi, işareti kaldır` : `${title}: ödendi olarak işaretle`}
            title={tx.paid ? "Ödendi" : "Ödendi olarak işaretle"}
            className="grid size-11 shrink-0 place-items-center"
          >
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full border-2 transition-all duration-200",
                tx.paid ? "scale-100 border-income-fill bg-income-fill text-on-fill" : "border-ink-3/60 hover:border-ink",
              )}
            >
              {tx.paid && <Check size={14} strokeWidth={3} />}
            </span>
          </button>
        )}

        {/* Masaüstü: üzerine gelince ya da klavye odağında görünen eylemler */}
        <div
          className={cn(
            "hidden w-0 shrink-0 items-center gap-0.5 overflow-hidden opacity-0 transition-all duration-200 group-focus-within:opacity-100 group-hover:opacity-100 lg:flex",
            remindable
              ? "group-focus-within:w-[7rem] group-hover:w-[7rem]"
              : "group-focus-within:w-[4.75rem] group-hover:w-[4.75rem]",
          )}
        >
          {remindable && (
            <button
              type="button"
              onClick={onRemind}
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full hover:bg-surface-2",
                reminding ? "text-expense" : "text-ink-2 hover:text-ink",
              )}
              aria-label={`${title} hatırlat`}
              title="Hatırlat"
            >
              {reminding ? <BellRing size={15} /> : <Bell size={15} />}
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
            aria-label={`${title} düzenle`}
            title="Düzenle"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-expense/15 hover:text-expense"
            aria-label={`${title} sil`}
            title="Sil"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </li>
  );
}
