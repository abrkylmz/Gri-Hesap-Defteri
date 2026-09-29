"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { cn } from "@/components/ui";

type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; text: string; tone: "default" | "error"; action?: ToastAction };
type Push = (text: string, tone?: Toast["tone"], action?: ToastAction) => void;

const ToastContext = createContext<Push>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback<Push>(
    (text, tone = "default", action) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-2), { id, text, tone, action }]);
      // Eylemli bildirimler ("Geri al") okunup dokunulabilsin diye daha uzun kalır.
      setTimeout(() => dismiss(id), action ? 6000 : tone === "error" ? 5000 : 2600);
      if (tone === "default") navigator.vibrate?.(8);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),1rem)] z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rise pointer-events-auto flex items-center gap-3 rounded-full py-2.5 pl-5 text-sm font-medium shadow-lg",
              t.action ? "pr-2" : "pr-5",
              t.tone === "error" ? "bg-expense text-white" : "bg-ink text-bg",
            )}
          >
            {t.text}
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  dismiss(t.id);
                  t.action!.onClick();
                }}
                className="rounded-full bg-bg/15 px-3 py-1 text-xs font-semibold text-income-fill transition-colors hover:bg-bg/25"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
