"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const CLOSE_MS = 220;
const DISMISS_DRAG_PX = 110;

/**
 * Native <dialog> tabanlı alt çekmece: odak hapsi, Esc ve erişilebilirlik tarayıcıdan gelir.
 * Kulptan aşağı sürükleyerek, arka plana dokunarak ya da Esc ile kapanır.
 *
 * `open` false olduğunda kapanış animasyonu oynar, bitince `onExited` çağrılır
 * (içeriği ancak o zaman DOM'dan kaldırın).
 */
export function Sheet({
  open,
  onClose,
  onExited,
  title,
  headerExtra,
  footer,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
  title: string;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  /** Masaüstünde geniş açılsın (tablolar için) */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const drag = useRef<{ startY: number; dy: number } | null>(null);
  const downOnBackdrop = useRef(false);
  const onExitedRef = useRef(onExited);
  useEffect(() => {
    onExitedRef.current = onExited;
  });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      // Kapanış sürerken yeniden açılırsa animasyonu iptal et.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM dialog durumu ile senkron
      setClosing(false);
      if (!d.open) {
        d.style.transition = "";
        d.style.transform = "";
        d.showModal();
        document.documentElement.style.overflow = "hidden";
      }
      return;
    }
    if (!d.open) return;
    setClosing(true);
    const t = setTimeout(() => {
      d.close();
      setClosing(false);
      document.documentElement.style.overflow = "";
      onExitedRef.current?.();
    }, CLOSE_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => () => void (document.documentElement.style.overflow = ""), []);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    drag.current.dy = dy;
    ref.current.style.transition = "none";
    ref.current.style.transform = `translateY(${dy}px)`;
  };
  const onPointerUp = () => {
    const d = ref.current;
    if (!drag.current || !d) return;
    const { dy } = drag.current;
    drag.current = null;
    d.style.transition = "transform 200ms cubic-bezier(0.22,1,0.36,1)";
    if (dy > DISMISS_DRAG_PX) {
      d.style.transform = "translateY(100%)";
      onClose();
    } else {
      d.style.transform = "";
    }
  };

  return (
    <dialog
      ref={ref}
      className="sheet outline-none"
      // Açılışta odak ilk düğmeye (Kapat) değil çekmecenin kendisine gelsin.
      autoFocus
      tabIndex={-1}
      data-closing={closing}
      data-wide={wide}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => (downOnBackdrop.current = e.target === ref.current)}
      onClick={(e) => {
        if (e.target === ref.current && downOnBackdrop.current) onClose();
      }}
    >
      <header className="shrink-0 px-5 pt-2">
        <div
          className="mx-auto flex h-6 w-24 cursor-grab touch-none items-center justify-center active:cursor-grabbing md:hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden
        >
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>
        <div className="flex items-center gap-3 pb-3 pt-1 md:pt-4">
          <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
          <div className="ml-auto flex items-center gap-2">
            {headerExtra}
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-2 hover:text-ink"
              aria-label="Kapat"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">{children}</div>
      {footer && <footer className="pb-safe shrink-0 border-t border-line px-5 pt-3">{footer}</footer>}
    </dialog>
  );
}

/**
 * Sheet'i "açılışta monte et, kapanış animasyonu bitince kaldır" düzeninde yöneten durum.
 * `item` null değilken içerik render edilir.
 */
export function useSheetState<T>() {
  const [item, setItem] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  const show = useCallback((value: T) => {
    setItem(value);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const exited = useCallback(() => setItem(null), []);
  return { item, open, show, close, exited };
}

/** İki aşamalı silme düğmesi: ilk dokunuşta onay ister. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmText = "Emin misin?",
  disabled,
  className = "",
}: {
  onConfirm: () => void;
  children: React.ReactNode;
  confirmText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={disabled}
      data-armed={armed}
      className={`btn btn-danger ${className}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmText : children}
    </button>
  );
}
