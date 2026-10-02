"use client";

import { Moon, Sun } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useTheme } from "@/components/theme";
import { cn } from "@/components/ui";

/**
 * Her ekrandan açık/koyu geçişi. O an görünen temanın tersine geçer (sistem tercihi de olsa);
 * "Sistem"e dönmek Ayarlar'dan. İkon CSS ile seçilir, böylece sunucu/istemci çıktısı aynı kalır.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { setPref } = useTheme();
  const toggle = () => {
    haptic("select");
    setPref(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Açık/koyu tema"
      title="Açık/koyu tema"
      className={cn(
        "grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2",
        className,
      )}
    >
      <Moon size={19} strokeWidth={2} className="dark:hidden" />
      <Sun size={19} strokeWidth={2} className="hidden dark:block" />
    </button>
  );
}
